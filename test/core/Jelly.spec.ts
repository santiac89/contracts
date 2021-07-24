import { ethers, waffle } from 'hardhat'
import { expect } from 'chai'
import IWhirlpool from '../../artifacts/contracts/utils/interfaces/IWhirlpool.sol/IWhirlpool.json'
import '../helpers/NumberExtensions'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { MockContract } from 'ethereum-waffle'
import { constants, ContractTransaction } from 'ethers'
import { Jelly } from '../../types/Jelly'

describe('Jelly', () => {
  let jelly: Jelly
  let owner: SignerWithAddress
  let creator: SignerWithAddress
  let creatorReferrer: SignerWithAddress
  let joiner: SignerWithAddress
  let joinerReferrer: SignerWithAddress
  let mockIWhirlpool: MockContract

  beforeEach(async () => {
    ;[owner, creator, creatorReferrer, joiner, joinerReferrer] = await ethers.getSigners()
    mockIWhirlpool = await waffle.deployMockContract(owner, IWhirlpool.abi)

    await mockIWhirlpool.mock.addConsumer.returns()
    await mockIWhirlpool.mock.request.returns(constants.HashZero)

    const jellyFactory = await ethers.getContractFactory('Jelly')
    jelly = (await jellyFactory.deploy(mockIWhirlpool.address)) as Jelly
    await jelly.enableWhirlpool()

    jelly = jelly.connect(creator)
  })

  describe('createBet', () => {
    it('creates a new bet', async () => {
      await jelly.createBet(1, creatorReferrer.address, { value: (0.01).eth })

      const bet = await jelly.bets(0)
      expect({ ...bet }).to.deep.include({
        creator: creator.address,
        value: (0.01).eth,
        bet: 1
      })
    })

    it("deducts bet amount from creator's wallet", async () => {
      await expect(await jelly.createBet(1, creatorReferrer.address, { value: (0.01).eth })).to.changeEtherBalances(
        [jelly, creator],
        [(0.01).eth, (-0.01).eth]
      )
    })

    it('creates a new bet even if referrer is address(0)', async () => {
      await jelly.createBet(1, constants.AddressZero, { value: (0.01).eth })

      const bet = await jelly.bets(0)

      expect({ ...bet }).to.deep.include({
        creator: creator.address,
        value: (0.01).eth,
        bet: 1
      })
    })

    it('throws an error if eth passed are less than minimum bet', async () => {
      await expect(
        jelly.createBet(1, creatorReferrer.address, {
          value: (0.001).eth
        })
      ).to.be.revertedWith('Less than minimum')
    })

    it('throws an error if bet is on anything other than 0 or 1', async () => {
      await expect(
        jelly.createBet(2, creatorReferrer.address, {
          value: (0.01).eth
        })
      ).to.be.revertedWith('function was called with incorrect parameters')
    })

    it('emits a BetCreated event', async () => {
      await expect(jelly.createBet(0, constants.AddressZero, { value: (0.01).eth }))
        .to.emit(jelly, 'BetCreated')
        .withArgs(0, creator.address, 0, (0.01).eth)
    })
  })

  describe('cancelBet', () => {
    beforeEach(async () => {
      await jelly.createBet(1, creatorReferrer.address, { value: (0.01).eth })
    })

    it('deletes an existing bet', async () => {
      await jelly.cancelBet(0)

      const bet = await jelly.bets(0)

      expect(bet.value).to.eq(0)
    })

    it('throws error if anyone else other than the creator tries to cancel the bet', async () => {
      await expect(jelly.connect(joiner).cancelBet(0)).to.be.revertedWith('Not your bet')
    })

    it('refunds the bet amount less cancellation fees', async () => {
      // cancellation fee = 1%
      await expect(await jelly.cancelBet(0)).to.changeEtherBalances(
        [jelly, creator, owner],
        [(-0.01).eth, (0.0099).eth, (0.0001).eth]
      )
    })

    it('emits a BetCancelled event', async () => {
      await expect(jelly.cancelBet(0)).to.emit(jelly, 'BetCancelled').withArgs(0)
    })
  })

  describe('acceptBet', () => {
    beforeEach(async () => {
      await jelly.createBet(1, creatorReferrer.address, { value: (0.01).eth })
    })

    it("deducts bet amount from joiner's wallet", async () => {
      await expect(
        await jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: (0.01).eth })
      ).to.changeEtherBalances([jelly, joiner], [(0.01).eth, (-0.01).eth])
    })

    it('emits BetAccepted event', async () => {
      await expect(jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: (0.01).eth }))
        .to.emit(jelly, 'BetAccepted')
        .withArgs(0, joiner.address)
    })

    it('sets joiner on the bet', async () => {
      await jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: (0.01).eth })

      const bet = await jelly.bets(0)
      expect({ ...bet }).to.deep.include({
        creator: creator.address,
        value: (0.01).eth,
        bet: 1,
        joiner: joiner.address
      })
    })

    it('throws error if the bet is unfair', async () => {
      await expect(
        jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: (0.02).eth })
      ).to.be.revertedWith('Unfair bet')
    })

    it('throws error if bet is unavailable', async () => {
      await expect(jelly.acceptBet(1, joinerReferrer.address)).to.be.revertedWith('Bet is unavailable')
    })

    it('throws error if bet is already accepted', async () => {
      await jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: (0.01).eth })

      await expect(
        jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: (0.01).eth })
      ).to.be.revertedWith('Bet is already accepted')
    })

    describe('on bet concluded', () => {
      let txPromise: Promise<ContractTransaction>
      let tx: ContractTransaction

      beforeEach(async () => {
        await jelly.createBet(1, creatorReferrer.address, { value: (0.01).eth })
        await jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: (0.01).eth })
      })

      describe('concluded with even randomness', () => {
        beforeEach(async () => {
          txPromise = jelly.connect(owner).consumeRandomness(constants.HashZero, 35252)
          tx = await txPromise
        })

        it('deletes the bet', async () => {
          const bet = await jelly.bets(0)
          expect(bet.value).to.eq(0)
        })

        it('emits a BetConcluded event', async () => {
          await expect(txPromise).to.emit(jelly, 'BetConcluded').withArgs(0, joinerReferrer.address, 0)
        })

        it('sends reward to bet joiner', async () => {
          await expect(tx).to.changeEtherBalances(
            [jelly, owner, creator, creatorReferrer, joiner, joinerReferrer],
            [(-0.02).eth, (0.0008).eth, 0, 0, (0.019).eth, (0.0002).eth]
          )
        })
      })

      describe('concluded with odd randomness', () => {
        beforeEach(async () => {
          txPromise = jelly.connect(owner).consumeRandomness(constants.HashZero, 79319)
          tx = await txPromise
        })

        it('deletes the bet', async () => {
          const bet = await jelly.bets(0)
          expect(bet.value).to.eq(0)
        })

        it('emits a BetConcluded event', async () => {
          await expect(txPromise).to.emit(jelly, 'BetConcluded').withArgs(0, creatorReferrer.address, 1)
        })

        it('sends reward to bet creator', async () => {
          await expect(tx).to.changeEtherBalances(
            [jelly, owner, creator, creatorReferrer, joiner, joinerReferrer],
            [(-0.02).eth, (0.0008).eth, (0.019).eth, (0.0002).eth, 0, 0]
          )
        })
      })
    })
  })
})
