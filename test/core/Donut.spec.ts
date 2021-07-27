import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { constants } from 'ethers'
import { MockDonut as Donut } from '../../types/MockDonut'
import '../helpers/NumberExtensions'
import { hashEndingWith } from '../helpers/Common'

describe('Donut', () => {
  let donut: Donut
  let owner: SignerWithAddress
  let creator: SignerWithAddress
  let referrer: SignerWithAddress

  beforeEach(async () => {
    ;[owner, creator, referrer] = await ethers.getSigners()
    const donutFactory = await ethers.getContractFactory('MockDonut')
    donut = (await donutFactory.deploy()) as Donut
    await donut.deployed()

    await donut.deposit({ value: (100).eth })

    donut = donut.connect(creator)
  })

  describe('placeBet', () => {
    it('throws error if bet amount is less than min', async () => {
      await expect(donut.placeBet(0x3, referrer.address, { value: (0.0001).eth })).to.be.revertedWith(
        'Less than minimum'
      )
    })

    it('throws error if bet amount is more than max', async () => {
      await expect(donut.placeBet(0x3, referrer.address, { value: (1).eth })).to.be.revertedWith('More than maximum')
    })

    it('adds the bet to list of bets', async () => {
      await donut.placeBet(3, referrer.address, { value: (0.02).eth })

      expect({ ...(await donut.bets(0)) }).to.deep.include({
        bet: 3,
        creator: creator.address,
        value: (0.02).eth
      })
    })

    it('emits BetPlaced event', async () => {
      await expect(donut.placeBet(0x3, referrer.address, { value: (0.02).eth }))
        .to.emit(donut, 'BetPlaced')
        .withArgs(0, 3, creator.address, (0.02).eth)
    })

    it('increments numBets', async () => {
      await donut.placeBet(0x2, referrer.address, { value: (0.02).eth })
      await donut.placeBet(0x3, referrer.address, { value: (0.02).eth })
      await donut.placeBet(0x4, referrer.address, { value: (0.02).eth })

      expect(await donut.numBets()).to.eq(3)
    })
  })

  describe('claim', () => {
    beforeEach(async () => {
      await donut.connect(owner).setBlockHash(hashEndingWith('f'))
    })

    it('throws error if bet was not created by the sender', async () => {
      await expect(donut.claim(0)).to.be.revertedWith('Nothing to claim')

      await donut.placeBet(0xf, referrer.address, { value: (0.02).eth })

      await expect(donut.connect(referrer).claim(0)).to.be.revertedWith('Nothing to claim')

      await expect(donut.claim(0)).to.emit(donut, 'BetClaimed') // works fine
    })

    it("throws error if player didn't win", async () => {
      await donut.placeBet(0x4, referrer.address, { value: (0.02).eth })

      await expect(donut.claim(0)).to.be.revertedWith("You didn't win")
    })

    it('throws error if block hash is 0 (when time is up to claim)', async () => {
      await donut.connect(owner).setBlockHash(hashEndingWith('0'))
      await donut.placeBet(0x0, referrer.address, { value: (0.02).eth })

      await expect(donut.claim(0)).to.be.revertedWith("You didn't win")

      await donut.connect(owner).setBlockHash(hashEndingWith('f0')) // works fine
      await donut.placeBet(0x0, referrer.address, { value: (0.02).eth })

      const reward = (0.02).eth.mul(15)

      await expect(await donut.claim(0)).to.changeEtherBalances(
        [donut, creator],
        [reward.mul(-1), reward.mul(95).div(100)]
      )
    })

    describe('if won', () => {
      beforeEach(async () => {
        await donut.placeBet(0xf, referrer.address, { value: (0.02).eth })
      })

      it('transfers the original amount times multiplier to the player, less fees', async () => {
        const reward = (0.02).eth.mul(15)

        await expect(await donut.claim(0)).to.changeEtherBalances(
          [donut, creator, owner, referrer],
          [reward.mul(-1), reward.mul(95).div(100), reward.mul(4).div(100), reward.mul(1).div(100)]
        )

        await donut.placeBet(0xf, constants.AddressZero, { value: (0.02).eth })

        await expect(await donut.claim(1)).to.changeEtherBalances(
          [donut, creator, owner, referrer],
          [reward.mul(-1), reward.mul(95).div(100), reward.mul(5).div(100), (0).eth]
        )
      })

      it('deletes the bet', async () => {
        await donut.claim(0)

        expect({ ...(await donut.bets(0)) }).to.deep.include({
          bet: 0,
          creator: constants.AddressZero,
          value: (0).wei
        })
      })

      it('emits BetClaimed event', async () => {
        await donut.placeBet(0xf, referrer.address, { value: (0.02).eth })

        await expect(donut.claim(0)).to.emit(donut, 'BetClaimed').withArgs(0, referrer.address)
      })
    })
  })

  describe('withdraw', () => {
    it('withraws the given amount from the contract', async () => {
      await expect(await donut.connect(owner).withdraw((10).eth)).to.changeEtherBalances(
        [donut, owner],
        [(-10).eth, (10).eth]
      )
    })

    it('fails if caller is not the owner', async () => {
      await expect(donut.withdraw((10).eth)).to.be.revertedWith('caller is not the owner')
    })
  })

  describe('setMultiplier', () => {
    it('sets reward multiplier to the given value', async () => {
      await donut.connect(owner).setBlockHash(hashEndingWith('f'))
      await donut.connect(owner).setMultiplier(2000)

      await donut.placeBet(0xf, referrer.address, { value: (0.1).eth })

      await expect(await donut.claim(0)).to.changeEtherBalances(
        [donut, creator, owner, referrer],
        [(-2).eth, (1.9).eth, (0.08).eth, (0.02).eth]
      )
    })
  })

  describe('hasWon', () => {
    it('returns true if the last digit of the block hash matches the bet', async () => {
      await donut.connect(owner).setBlockHash(hashEndingWith('afe3363d'))
      await donut.placeBet(0xd, referrer.address, { value: (0.1).eth })

      expect(await donut.hasWon(0)).to.eq(true)
    })

    it('returns false if no bet exists', async () => {
      expect(await donut.hasWon(0)).to.eq(false)
    })
  })
})
