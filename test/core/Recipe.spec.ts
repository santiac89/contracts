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
    i: i.i,
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

    // prettier-ignore
    return [
      bid(1), bid(2), bid(3), bid(4), bid(5),
      bid(1), bid(2), bid(3), bid(4), bid(5)
    ]
  }

  const highestBid = () => allBids()[15]
  const nextHighestBid = () => allBids()[11]
  const bidsSum = (n = 25) =>
    allBids()
      .slice(0, n)
      .reduce((a, b) => a.add(b.value), (0).wei)
  const simpleBidsSum = (n = 10) =>
    simpleBids()
      .slice(0, n)
      .reduce((a, b) => a.add(b.value), (0).wei)

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
        total: bidsSum(),
        numBidders: (25).wei,
        highestBid: highestBid().value,
        pendingReward: (0).wei,
        winner: constants.AddressZero,
        lastPick: (0).wei
      })
    })

    it('increases bids for all existing bidders if called twice', async () => {
      // simple bids have some duplicates to allow for full test coverage
      await createSimpleBids(10)
      await createSimpleBids(10)

      expect(await recipe.enumerateSortedBids(0, 5)).to.eql(
        sorted(
          simpleBids()
            .slice(0, 5)
            .map(({ value }) => value.mul(2))
        )
      )

      expect(await recipe.enumerateBids(0, 10)).to.eql(simpleBids().map(({ value }) => value.mul(2)))

      for (const { bidder } of simpleBids()) {
        expect(await recipe.hasBidder(0, bidder.address)).to.eq(true)
      }

      expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
        total: simpleBidsSum().mul(2),
        numBidders: (10).wei,
        highestBid: (10).eth,
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
            total: bidsSum(),
            numBidders: (25).wei,
            highestBid: highestBid().value,
            pendingReward: bidsSum().sub(highestBid().value),
            winner: highestBid().bidder.address,
            lastPick: time.wei
          })
          expect(await recipe.currentRound()).to.eq(1)
        })

        it('emits a RoundEnded event', async () => {
          await expect(txPromise).to.emit(recipe, 'RoundEnded').withArgs(0, highestBid().bidder.address)
        })

        it('marks all pooled bids as pending reward of the winner', async () => {
          expect(await recipe.bidderInfo(0, highestBid().bidder.address)).to.eql([
            highestBid().value,
            bidsSum().sub(highestBid().value)
          ])
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
            total: bidsSum(),
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
            total: bidsSum(),
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
            total: bidsSum(),
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

    it('eliminates fine even if multiple bids have same values', async () => {
      await createSimpleBids(10)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      await fastForward((10).minutes)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      await fastForward((10).minutes)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
        total: simpleBidsSum(),
        numBidders: (7).wei,
        highestBid: (5).eth,
        pendingReward: (6).eth,
        winner: constants.AddressZero
      })

      expect(await recipe.enumerateSortedBids(0, 5)).to.eql(
        sorted(
          simpleBids()
            .slice(0, 5)
            .map(({ value }) => value)
        )
      )
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
        total: (13).eth.sub((2).eth.div(14)), // 15 - 2 - 2 / (15 - 1)
        numBidders: (3).wei, // one eliminated, one claimed
        highestBid: (5).eth,
        pendingReward: (1).eth.sub((2).eth.div(14)), // 1 - 2 / (15 - 1)
        winner: constants.AddressZero
      })

      await recipe.connect(bidders[2]).claim(0)

      expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
        total: (10).eth.sub((5).eth.div(14)), // 15 - 2 - 2 / (15 - 1) - 3 - 3 / (15 - 1)
        numBidders: (2).wei, // one eliminated, two claimed
        highestBid: (5).eth,
        pendingReward: (1).eth.sub((5).eth.div(14)), // 1 - 2 / (15 - 1) - 3 / (15 - 1)
        winner: constants.AddressZero
      })

      await recipe.connect(bidders[3]).claim(0)

      expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
        total: (6).eth
          .sub((9).eth.div(14)) // 15 - 2 - 2 / (15 - 1) - 3 - 3 / (15 - 1) - 4 - 4 / (15 - 1)
          .add(1), // rounding error
        numBidders: (1).wei, // one eliminated, three claimed
        highestBid: (5).eth,
        pendingReward: (1).eth
          .sub((9).eth.div(14)) // 1 - 2 / (15 - 1) - 3 / (15 - 1) - 4 / (15 - 1)
          .add(1 /* rounding error */),
        winner: constants.AddressZero
      })

      await recipe.connect(bidders[4]).claim(0)

      expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
        total: (0).eth, // 15 - 2 - 2 / (15 - 1) - 3 - 3 / (15 - 1) - 4 - 4 / (15 - 1) - 5 - 5 / (15 - 1)
        numBidders: (0).wei, // one eliminated, all claimed
        highestBid: (0).eth,
        pendingReward: (0).eth, // 1 - 2 / (15 - 1) - 3 / (15 - 1) - 4 / (15 - 1) - 5 / (15 - 1)
        winner: constants.AddressZero
      })
    })

    it('emits a Claimed event', async () => {
      await createSimpleBids(5)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      await expect(recipe.connect(bidders[1]).claim(0))
        .to.emit(recipe, 'Claimed')
        .withArgs(0, bidders[1].address, (2).eth.add((2).eth.div(14)))
    })

    it('transfers the original bid amount to the bidder, less fees and referral bonus', async () => {
      await createSimpleBids(5)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      const reward = (2).eth.add((2).eth.div(14))

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

    it('allows claim even if no one was eliminated', async () => {
      await createSimpleBids(1)

      await expect(await recipe.claim(0)).to.changeEtherBalances(
        [recipe, bidders[0], owner, referrers[0]],
        [(-1).eth, (0.95).eth, (0.04).eth, (0.01).eth]
      )

      expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
        total: (0).eth,
        numBidders: (0).wei,
        highestBid: (0).eth,
        pendingReward: (0).eth,
        winner: constants.AddressZero
      })
    })

    it('processes claim fine even if multiple bids have the same value', async () => {
      await createSimpleBids(10)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      await fastForward((10).minutes)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      await fastForward((10).minutes)
      await recipe.eliminate()
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 0)

      await recipe.connect(bidders[3]).claim(0)
      await recipe.connect(bidders[4]).claim(0)

      // all bids are still there (since there were two of each)
      expect(await recipe.enumerateSortedBids(0, 5)).to.eql(
        sorted(
          simpleBids()
            .slice(0, 5)
            .map(({ value }) => value)
        )
      )

      // 3 eliminated, 2 claimed, 5 remain
      expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
        total: (18.75).eth, // 30 - 9 - 6 * 9 / (30 - 6)
        numBidders: (5).wei,
        highestBid: (5).eth,
        pendingReward: (3.75).eth, // 6 - 6 * 9 / (30 - 6)
        winner: constants.AddressZero
      })
    })

    describe('when the highest bidder wins', async () => {
      beforeEach(async () => {
        await createBids(25)
        await recipe.eliminate()
        await recipe.connect(owner).consumeRandomness(constants.HashZero, 1015)
      })

      it('makes claims of everyone else fail', async () => {
        for (let { bidder, value } of allBids()) {
          if (value.eq(highestBid().value)) continue

          await expect(recipe.connect(bidder).claim(0)).to.be.revertedWith('Nothing to claim')
        }
      })

      it("transfers all of pool's money to the winner", async () => {
        const { bidder, referrer } = highestBid()
        const reward = bidsSum()

        await expect(await recipe.connect(bidder).claim(0)).to.changeEtherBalances(
          [recipe, bidder, owner, referrer],
          [
            reward.mul(-1),
            reward.sub(reward.mul(5).div(100)), // 95%
            reward.mul(5).div(100).sub(reward.mul(1).div(100)), // 4%
            reward.mul(1).div(100)
          ]
        )
      })
    })

    describe('when a couple bids get eliminated', async () => {
      beforeEach(async () => {
        await createBids(25)

        // lets eliminate 0, 4, 8, 12, 16, 20, 24
        // after elimination, indexes are: 0, 3, 6, 9, 12, 15, 18
        for (let i = 0; i < 7; i++) {
          await recipe.eliminate()
          await fastForward((10).minutes)
          await recipe.connect(owner).consumeRandomness(constants.HashZero, i * 3)
        }
      })

      it('processes claim of everyone appropriately', async () => {
        for (let { bidder, i } of allBids()) {
          if (i % 4 == 0) {
            await expect(recipe.connect(bidder).claim(0)).to.be.revertedWith('Nothing to claim')
          } else {
            await recipe.connect(bidder).claim(0) // works fine
          }
        }
      })

      it('is zero sum, if everyone claims', async () => {
        for (let { bidder, i } of allBids()) {
          if (i % 4 != 0) {
            await recipe.connect(bidder).claim(0)
          }
        }

        expect({ ...(await recipe.roundInfo(0)) }).to.deep.include({
          total: (0).eth,
          numBidders: (0).wei,
          highestBid: (0).eth,
          pendingReward: (0).eth,
          winner: constants.AddressZero
        })
      })
    })
  })

  describe('configure', () => {
    it('throws error if values are out of bounds', async () => {
      const msg = 'Value exceeds max amount'

      await expect(recipe.connect(owner).configure(10001, (1).hour, 20, (2).eth)).to.be.revertedWith(msg)
      await expect(recipe.connect(owner).configure(100, (5).hours, 20, (2).eth)).to.be.revertedWith(msg)
    })

    it('sets new configuration', async () => {
      await recipe.connect(owner).configure(10, (1).hour, 30, (200).eth)
      await createBids(25)

      await expect(recipe.eliminate()).to.be.revertedWith('Min amount not reached')

      await recipe.connect(owner).configure(10, (1).hour, 30, (2).eth)

      await expect(recipe.eliminate()).to.be.revertedWith('Min bids not reached')

      await recipe.connect(owner).configure(10, (1).hour, 5, (2).eth)
      await recipe.eliminate() // works fine
      await recipe.connect(owner).consumeRandomness(constants.HashZero, 24) // eliminate the last person

      await expect(recipe.eliminate()).to.be.revertedWith('Must cooldown first')

      await fastForward((20).minutes) // cooldown time is not up yet

      await expect(recipe.eliminate()).to.be.revertedWith('Must cooldown first')

      await fastForward((40).minutes) // 1 hour is up
      await recipe.eliminate() // works fine

      // highest bidder has now moved to 14
      // the win chance of highest bidder is 0.1% (10 / 10000), but the position is 14
      // which makes it impossible since 14 % 10000 = 14 (which is < 10)
      await expect(recipe.connect(owner).consumeRandomness(constants.HashZero, 14))
        .to.emit(recipe, 'BidderEliminated')
        .withArgs(0, highestBid().bidder.address)
    })
  })
})
