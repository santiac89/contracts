import { ethers, waffle } from 'hardhat'
import { expect } from 'chai'
import IWhirlpool from '../../artifacts/contracts/utils/interfaces/IWhirlpool.sol/IWhirlpool.json'
import '../helpers/NumberExtensions'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { MockContract } from 'ethereum-waffle'
import { BigNumber, constants, ContractTransaction } from 'ethers'
import { TestRecipe as Recipe } from '../../types/TestRecipe'
import { fastForward, snapshot } from '../helpers/Common'

function sorted(entries: BigNumber[]) {
  return [...entries].sort((a, b) => {
    if (a.lt(b)) return -1
    if (a.gt(b)) return 1
    return 0
  })
}

describe('Recipe', () => {
  let recipe: Recipe
  let owner: SignerWithAddress
  let bidders: SignerWithAddress[]
  let referrers: SignerWithAddress[]
  let mockIWhirlpool: MockContract

  const bidFactory = (i: { i: number }) => (value: number) => ({
    value: value.eth,
    bidder: bidders[i.i],
    referrer: referrers[i.i++]
  })

  const allBids = () => {
    const bid = bidFactory({ i: 0 })

    // prettier-ignore
    return [
      bid(0.653), bid(0.133), bid(0.311), bid(0.682), bid(0.019),
      bid(0.322), bid(0.201), bid(0.161), bid(0.594), bid(0.004),
      bid(0.581), bid(0.694), bid(0.253), bid(0.216), bid(0.323),
      bid(0.978), bid(0.557), bid(0.605), bid(0.223), bid(0.058),
      bid(0.069), bid(0.285), bid(0.407), bid(0.126), bid(0.386)
    ]
  }

  const simpleBids = () => {
    const bid = bidFactory({ i: 0 })
    return [bid(1), bid(2), bid(3), bid(4), bid(5)]
  }

  const highestBid = () => allBids()[15]
  const nextHighestBid = () => allBids()[11]
  const totalSum = () => allBids().reduce((a, b) => a.add(b.value), (0).wei)

  const createBids = async (n = 1, simple = false) => {
    for (const { value, bidder, referrer } of (simple ? simpleBids() : allBids()).slice(0, n)) {
      await recipe.connect(bidder).createBid(0, referrer.address, { value })
    }
  }
  const createSimpleBids = (n = 1) => createBids(n, true)

  beforeEach(async () => {
    const signers = await ethers.getSigners()
    owner = signers.shift()!
    bidders = signers.splice(0, 25)
    referrers = signers

    mockIWhirlpool = await waffle.deployMockContract(owner, IWhirlpool.abi)

    await mockIWhirlpool.mock.addConsumer.returns()
    await mockIWhirlpool.mock.request.returns(constants.HashZero)

    const recipeFactory = await ethers.getContractFactory('TestRecipe')
    recipe = (await recipeFactory.deploy(mockIWhirlpool.address)) as Recipe
    await recipe.enableWhirlpool()

    recipe = recipe.connect(bidders[0])
  })

  describe('createBid', () => {
    it('throws error if not betting in the current round', async () => {
      await expect(recipe.createBid(1, constants.AddressZero, { value: (0.01).eth })).to.be.revertedWith(
        'Recipe: Not current round'
      )
    })

    it('throws error if the current round has ended', async () => {
      await createBids(25)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 1015)

      await expect(recipe.createBid(0, constants.AddressZero, { value: (0.01).eth })).to.be.revertedWith(
        'Recipe: Not current round'
      )
    })

    it('adds the bids to the list of bids', async () => {
      await createBids(25)

      expect(await recipe.enumerateSortedBids(0, 25)).to.eql(sorted(allBids().map(({ value }) => value)))
      expect(await recipe.enumerateBids(0, 25)).to.eql(allBids().map(({ value }) => value))

      for (const { bidder } of allBids()) {
        expect(await recipe.hasBidder(0, bidder.address)).to.eq(true)
      }

      expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
        total: totalSum(),
        numBidders: (25).wei,
        highestBid: highestBid().value,
        pendingReward: (0).wei,
        winner: constants.AddressZero,
        lastPick: (0).wei
      })
    })

    it('increases bids for all existing bidders if called twice', async () => {
      await createBids(25)
      await createBids(25)

      expect(await recipe.enumerateSortedBids(0, 25)).to.eql(sorted(allBids().map(({ value }) => value.mul(2))))
      expect(await recipe.enumerateBids(0, 25)).to.eql(allBids().map(({ value }) => value.mul(2)))

      for (const { bidder } of allBids()) {
        expect(await recipe.hasBidder(0, bidder.address)).to.eq(true)
      }

      expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
        total: totalSum().mul(2),
        numBidders: (25).wei,
        highestBid: highestBid().value.mul(2),
        pendingReward: (0).wei,
        winner: constants.AddressZero,
        lastPick: (0).wei
      })
    })

    it('emits BidCreated event', async () => {
      await expect(recipe.createBid(0, constants.AddressZero, { value: (1).eth }))
        .to.emit(recipe, 'BidCreated')
        .withArgs(0, bidders[0].address, (1).eth)
    })
  })

  describe('eliminate', () => {
    it('throws error if min bids not yet reached', async () => {
      await recipe.createBid(0, constants.AddressZero, { value: (0.5).eth })

      await expect(recipe.eliminate()).to.be.revertedWith('Min amount not reached')
    })

    it('throws error if min amount not yet reached', async () => {
      await recipe.createBid(0, constants.AddressZero, { value: (1).eth })

      await expect(recipe.eliminate()).to.be.revertedWith('Min bids not reached')
    })

    it("throws error if cooldown conditions haven't been met", async () => {
      await createBids(10)
      await recipe.eliminate() // one works fine

      await expect(recipe.eliminate()).to.be.revertedWith('Must cooldown first')

      await fastForward((10).minutes)

      await recipe.eliminate() // one works fine too
    })

    describe('on elimination', () => {
      let time: number
      let txPromise: Promise<ContractTransaction>
      let tx: ContractTransaction

      beforeEach(async () => {
        await createBids(25)
        await snapshot(async t => {
          await recipe.eliminate()
          time = t
        })
      })

      describe('if highest bidder is picked and odds are in his favour', () => {
        beforeEach(async () => {
          txPromise = recipe.connect(owner).consumeRandomness(constants.HashZero, 1015)
          tx = await txPromise
        })

        it('ends the round', async () => {
          expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
            total: totalSum(),
            numBidders: (25).wei,
            highestBid: highestBid().value,
            pendingReward: totalSum(),
            winner: highestBid().bidder.address,
            lastPick: time.wei
          })
          expect(await recipe.currentRound()).to.eq(1)
        })

        it('emits a RoundEnded event', async () => {
          await expect(txPromise).to.emit(recipe, 'RoundEnded').withArgs(0, highestBid().bidder.address)
        })

        it('marks all pooled bids as pending reward of the winner', async () => {
          expect(await recipe.bidderInfo(0, highestBid().bidder.address)).to.eql([highestBid().value, totalSum()])
        })
      })

      describe('if the odds are not in favour of the highest bidder', () => {
        beforeEach(async () => {
          txPromise = recipe.connect(owner).consumeRandomness(constants.HashZero, 7015)
          tx = await txPromise
        })

        it('eliminates the bidder', async () => {
          expect(await recipe.currentRound()).to.eq(0)
          expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
            total: totalSum(),
            numBidders: (24).wei,
            highestBid: nextHighestBid().value,
            pendingReward: highestBid().value,
            winner: constants.AddressZero,
            lastPick: time.wei
          })
        })

        it('emits a BidderEliminated event', async () => {
          await expect(txPromise).to.emit(recipe, 'BidderEliminated').withArgs(0, highestBid().bidder.address)
        })

        it("deletes the bidder's bid", async () => {
          expect(await recipe.bidderInfo(0, highestBid().bidder.address)).to.eql([(0).wei, (0).wei])
        })
      })

      describe('anyone else gets eliminated', () => {
        beforeEach(async () => {
          txPromise = recipe.connect(owner).consumeRandomness(constants.HashZero, 7000)
          tx = await txPromise
        })

        it('eliminates the bidder', async () => {
          expect(await recipe.currentRound()).to.eq(0)
          expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
            total: totalSum(),
            numBidders: (24).wei,
            highestBid: highestBid().value,
            pendingReward: allBids()[0].value,
            winner: constants.AddressZero,
            lastPick: time.wei
          })
        })

        it('emits a BidderEliminated event', async () => {
          await expect(txPromise).to.emit(recipe, 'BidderEliminated').withArgs(0, allBids()[0].bidder.address)
        })

        it("deletes the bidder's bid", async () => {
          expect(await recipe.bidderInfo(0, allBids()[0].bidder.address)).to.eql([(0).wei, (0).wei])
        })
      })

      describe('multiple bidders get eliminated', () => {
        beforeEach(async () => {
          for (let i = 0; i < 5; i++) {
            await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)
          }
        })

        it('adds to the pending rewards for the rest', async () => {
          expect(await recipe.currentRound()).to.eq(0)
          expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
            total: totalSum(),
            numBidders: (20).wei,
            highestBid: highestBid().value,
            pendingReward: allBids()
              .slice(0, 5)
              .reduce((a, b) => a.add(b.value), (0).wei),
            winner: constants.AddressZero,
            lastPick: time.wei
          })
        })
      })
    })
  })

  describe('claim', () => {
    it("throws an error if player didn't place a bid", async () => {
      await createBids(1)
      await expect(recipe.connect(bidders[1]).claim(0)).to.be.revertedWith('Nothing to claim')
    })

    it('throws error if player was eliminated', async () => {
      await createBids(5)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      await expect(recipe.claim(0)).to.be.revertedWith('Nothing to claim')
    })

    it('throws an error if player has already claimed', async () => {
      await createBids(5)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      await recipe.connect(bidders[1]).claim(0) // works fine

      await expect(recipe.connect(bidders[1]).claim(0)).to.be.revertedWith('Nothing to claim')
    })

    it('removes the bid from the pool and pending rewards', async () => {
      await createSimpleBids(5)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      await recipe.connect(bidders[1]).claim(0)

      expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
        total: (13).eth.sub((2).eth.div(15)), // 15 - 2 - 2 / 15
        numBidders: (3).wei, // one eliminated, one claimed
        highestBid: (5).eth,
        pendingReward: (1).eth.sub((2).eth.div(15)), // 1 - 2 / 15
        winner: constants.AddressZero
      })
    })

    it('emits a Claimed event', async () => {
      await createSimpleBids(5)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      await expect(recipe.connect(bidders[1]).claim(0))
        .to.emit(recipe, 'Claimed')
        .withArgs(0, bidders[1].address, (2).eth.add((2).eth.div(15)))
    })

    it('transfers the original bid amount to the bidder, less fees and referral bonus', async () => {
      await createSimpleBids(5)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      const reward = (2).eth.add((2).eth.div(15))

      await expect(await recipe.connect(bidders[1]).claim(0)).to.changeEtherBalances(
        [recipe, bidders[1], owner, referrers[1]],
        [
          reward.mul(-1),
          reward.sub(reward.mul(5).div(100)), // 95%
          reward.mul(5).div(100).sub(reward.mul(1).div(100)), // 4%
          reward.mul(1).div(100)
        ]
      )
    })

    describe('when the highest bidder wins', async () => {
      it('makes claims of everyone else fail', async () => {})
    })

    it('is zero sum, if everyone claims', async () => {})
  })
})
