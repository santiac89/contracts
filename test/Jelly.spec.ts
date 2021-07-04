import { ethers } from 'hardhat'
import { expect } from 'chai'
import { Contract, ContractTransaction } from '@ethersproject/contracts'
import { hexZeroPad, parseEther } from 'ethers/lib/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'

describe('Jelly', () => {
  let jelly: Contract
  let owner: SignerWithAddress
  let creator: SignerWithAddress
  let referrer: SignerWithAddress
  const dead = hexZeroPad('0x0', 20)

  beforeEach(async () => {
    ;[owner, creator, referrer] = await ethers.getSigners()

    const Jelly = (await ethers.getContractFactory('Jelly')).connect(owner)
    jelly = (await Jelly.deploy()).connect(creator)
    await jelly.deployed()
  })

  describe('createBet', () => {
    it('creates a new bet', async () => {
      await jelly.createBet(1, referrer.address, { value: parseEther('0.01') })

      const bet = await jelly.bets(0)
      expect({ ...bet }).to.deep.include({
        id: BigNumber.from(0),
        creator: creator.address,
        referrer: referrer.address,
        value: parseEther('0.01'),
        cancelled: false,
        fruit: 1
      })
    })

    it("deducts bet amount from creator's wallet", async () => {
      const tx = await jelly.createBet(1, referrer.address, { value: parseEther('0.01') })

      await expect(tx).to.changeEtherBalance(creator, parseEther('-0.01'))
    })

    it('creates a new bet even if referrer is address(0)', async () => {
      await jelly.createBet(1, dead, { value: parseEther('0.01') })

      const bet = await jelly.bets(0)

      expect(bet.referrer).to.eq(dead)
    })

    it('throws an error if no ether is passed', async () => {
      await expect(jelly.createBet(1, referrer.address)).to.be.revertedWith('Bet amount cannot be 0')
    })

    it('throws an error if ether passed are less than minimum bet', async () => {
      await expect(
        jelly.createBet(1, referrer.address, {
          value: parseEther('0.001')
        })
      ).to.be.revertedWith('Bet amount is lower than minimum bet amount')
    })

    it('throws an error if bet is on anything other than 0 or 1', async () => {
      await expect(
        jelly.createBet(2, referrer.address, {
          value: parseEther('0.01')
        })
      ).to.be.revertedWith('function was called with incorrect parameters')
    })

    it('emits a BetCreated event', async () => {
      await expect(jelly.createBet(0, dead, { value: parseEther('0.01') }))
        .to.emit(jelly, 'BetCreated')
        .withArgs(0, creator.address, 0, parseEther('0.01'))
    })
  })

  describe('cancelBet', () => {
    it('cancels an existing bet', async () => {
      await jelly.createBet(1, referrer.address, { value: parseEther('0.01') })
      await jelly.cancelBet(0)

      const bet = await jelly.bets(0)

      expect(bet.cancelled).to.eq(true)
    })

    it('throws error if anyone else other than the creator tries to cancel the bet', async () => {
      await jelly.createBet(1, referrer.address, { value: parseEther('0.01') })

      jelly = jelly.connect(referrer)

      await expect(jelly.cancelBet(0)).to.be.revertedWith("You didn't create this bet")
    })

    it('refunds the bet amount less cancellation fees', async () => {
      await jelly.createBet(1, referrer.address, { value: parseEther('1') })
      const tx = await jelly.cancelBet(0)

      // cancellation fee = 1%
      await expect(tx).to.changeEtherBalances([creator, owner], [parseEther('0.99'), parseEther('0.01')])
    })

    it('adds the cancellation fee to commission', async () => {
      expect(await jelly.connect(owner).commission()).to.eq(0)

      await jelly.createBet(1, referrer.address, { value: parseEther('1') })
      await jelly.createBet(0, referrer.address, { value: parseEther('1') })
      await jelly.cancelBet(0)

      expect(await jelly.connect(owner).commission()).to.eq(parseEther('0.01'))

      await jelly.cancelBet(1)

      expect(await jelly.connect(owner).commission()).to.eq(parseEther('0.02'))
    })

    it('throws error if bet is unavailable', async () => {
      await expect(jelly.cancelBet(1)).to.be.revertedWith('Bet is unavailable')
    })

    it('throws error if bet is already cancelled', async () => {
      await jelly.createBet(1, referrer.address, { value: parseEther('0.01') })
      await jelly.cancelBet(0)

      await expect(jelly.cancelBet(0)).to.be.revertedWith('Bet is unavailable')
    })

    it('emits a BetCancelled event', async () => {
      await jelly.createBet(0, dead, { value: parseEther('0.01') })

      await expect(jelly.cancelBet(0))
        .to.emit(jelly, 'BetCancelled')
        .withArgs(0, creator.address, 0, parseEther('0.01'))
    })
  })
})
