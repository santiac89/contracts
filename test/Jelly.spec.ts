import { ethers, waffle } from 'hardhat'
import { expect } from 'chai'
import { Contract } from '@ethersproject/contracts'
import { parseEther } from 'ethers/lib/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, constants, ContractFactory, ContractTransaction, Wallet } from 'ethers'
import Jelly from '../artifacts/contracts/Jelly.sol/Jelly.json'
import IWhirlpool from '../artifacts/contracts/interfaces/IWhirlpool.sol/IWhirlpool.json'
import { MockContract } from 'ethereum-waffle'

describe('Jelly', () => {
  let jelly: Contract
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

    const jellyFactory = new ContractFactory(Jelly.abi, Jelly.bytecode, owner)
    jelly = (await jellyFactory.deploy(mockIWhirlpool.address)).connect(creator)
  })

  describe('createBet', () => {
    it('creates a new bet', async () => {
      await jelly.createBet(1, creatorReferrer.address, { value: parseEther('0.01') })

      const bet = await jelly.bets(0)
      expect({ ...bet }).to.deep.include({
        creator: creator.address,
        value: parseEther('0.01'),
        cancelled: false,
        concluded: false,
        fruit: 1
      })
    })

    it("deducts bet amount from creator's wallet", async () => {
      await expect(
        await jelly.createBet(1, creatorReferrer.address, { value: parseEther('0.01') })
      ).to.changeEtherBalances([creator, jelly], [parseEther('-0.01'), parseEther('0.01')])
    })

    it('creates a new bet even if referrer is address(0)', async () => {
      await jelly.createBet(1, constants.AddressZero, { value: parseEther('0.01') })

      const bet = await jelly.bets(0)

      expect({ ...bet }).to.deep.include({
        creator: creator.address,
        value: parseEther('0.01'),
        cancelled: false,
        concluded: false,
        fruit: 1
      })
    })

    it('throws an error if ether passed are less than minimum bet', async () => {
      await expect(
        jelly.createBet(1, creatorReferrer.address, {
          value: parseEther('0.001')
        })
      ).to.be.revertedWith('Jelly: Bet amount is lower than minimum bet amount')
    })

    it('throws an error if bet is on anything other than 0 or 1', async () => {
      await expect(
        jelly.createBet(2, creatorReferrer.address, {
          value: parseEther('0.01')
        })
      ).to.be.revertedWith('function was called with incorrect parameters')
    })

    it('emits a BetCreated event', async () => {
      await expect(jelly.createBet(0, constants.AddressZero, { value: parseEther('0.01') }))
        .to.emit(jelly, 'BetCreated')
        .withArgs(0, creator.address, 0, parseEther('0.01'))
    })
  })

  describe('cancelBet', () => {
    beforeEach(async () => {
      await jelly.createBet(1, creatorReferrer.address, { value: parseEther('0.01') })
    })

    it('cancels an existing bet', async () => {
      await jelly.cancelBet(0)

      const bet = await jelly.bets(0)

      expect(bet.cancelled).to.eq(true)
    })

    it('throws error if anyone else other than the creator tries to cancel the bet', async () => {
      await expect(jelly.connect(joiner).cancelBet(0)).to.be.revertedWith("Jelly: You didn't create this bet")
    })

    it('refunds the bet amount less cancellation fees', async () => {
      // cancellation fee = 1%
      await expect(await jelly.cancelBet(0)).to.changeEtherBalances(
        [creator, owner],
        [parseEther('0.0099'), parseEther('0.0001')]
      )
    })

    it('throws error if bet is unavailable', async () => {
      await expect(jelly.cancelBet(1)).to.be.revertedWith('Jelly: Bet is unavailable')
    })

    it('throws error if bet is already cancelled', async () => {
      await jelly.cancelBet(0)

      await expect(jelly.cancelBet(0)).to.be.revertedWith('Jelly: Bet is already cancelled')
    })

    it('throws error if bet is already accepted', async () => {
      await jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: parseEther('0.01') })

      await expect(jelly.cancelBet(0)).to.be.revertedWith('Jelly: Bet is already accepted')
    })

    it('emits a BetCancelled event', async () => {
      await expect(jelly.cancelBet(0)).to.emit(jelly, 'BetCancelled').withArgs(0)
    })
  })

  describe('acceptBet', () => {
    beforeEach(async () => {
      await jelly.createBet(1, creatorReferrer.address, { value: parseEther('0.01') })
    })

    it("deducts bet amount from joiner's wallet", async () => {
      await expect(
        await jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: parseEther('0.01') })
      ).to.changeEtherBalances([joiner, jelly], [parseEther('-0.01'), parseEther('0.01')])
    })

    it('sets joiner on the bet', async () => {
      await jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: parseEther('0.01') })

      const bet = await jelly.bets(0)
      expect({ ...bet }).to.deep.include({
        creator: creator.address,
        value: parseEther('0.01'),
        cancelled: false,
        concluded: false,
        fruit: 1,
        joiner: joiner.address
      })
    })

    it('throws error if the bet is unfair', async () => {
      await expect(
        jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: parseEther('0.02') })
      ).to.be.revertedWith('Jelly: Unfair bet')
    })

    it('throws error if bet is unavailable', async () => {
      await expect(jelly.acceptBet(1, joinerReferrer.address)).to.be.revertedWith('Jelly: Bet is unavailable')
    })

    it('throws error if bet is already cancelled', async () => {
      await jelly.cancelBet(0)

      await expect(jelly.acceptBet(0, joinerReferrer.address, { value: parseEther('0.01') })).to.be.revertedWith(
        'Jelly: Bet is already cancelled'
      )
    })

    it('throws error if bet is already accepted', async () => {
      await jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: parseEther('0.01') })

      await expect(
        jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: parseEther('0.01') })
      ).to.be.revertedWith('Jelly: Bet is already accepted')
    })

    describe('on bet concluded', () => {
      let txPromise: Promise<ContractTransaction>
      let tx: ContractTransaction

      beforeEach(async () => {
        await jelly.createBet(1, creatorReferrer.address, { value: parseEther('0.01') })
        await jelly.connect(joiner).acceptBet(0, joinerReferrer.address, { value: parseEther('0.01') })
      })

      describe('concluded with even randomness', () => {
        beforeEach(async () => {
          txPromise = jelly.connect(owner).consumeRandomness(constants.HashZero, 35252)
          tx = await txPromise
        })

        it('concludes the bet', async () => {
          const bet = await jelly.bets(0)
          expect({ ...bet }).to.deep.include({
            concluded: true,
            result: 0
          })
        })

        it('emits a BetConcluded event', async () => {
          await expect(txPromise).to.emit(jelly, 'BetConcluded').withArgs(0, 0)
        })

        it('sends reward to bet joiner', async () => {
          await expect(tx).to.changeEtherBalances(
            [owner, creator, creatorReferrer, joiner, joinerReferrer],
            [parseEther('0.0008'), 0, 0, parseEther('0.019'), parseEther('0.0002'), 0, 0]
          )
        })
      })

      describe('concluded with odd randomness', () => {
        beforeEach(async () => {
          txPromise = jelly.connect(owner).consumeRandomness(constants.HashZero, 79319)
          tx = await txPromise
        })

        it('concludes the bet', async () => {
          const bet = await jelly.bets(0)
          expect({ ...bet }).to.deep.include({
            concluded: true,
            result: 1
          })
        })

        it('emits a BetConcluded event', async () => {
          await expect(txPromise).to.emit(jelly, 'BetConcluded').withArgs(0, 1)
        })

        it('sends reward to bet creator', async () => {
          await expect(tx).to.changeEtherBalances(
            [owner, creator, creatorReferrer, joiner, joinerReferrer],
            [parseEther('0.0008'), parseEther('0.019'), parseEther('0.0002'), 0, 0]
          )
        })

        it('throws error if bet is already concluded', async () => {
          await expect(jelly.connect(owner).consumeRandomness(constants.HashZero, 79319)).to.be.revertedWith(
            'Jelly: Bet is already concluded'
          )
        })
      })
    })
  })
})
