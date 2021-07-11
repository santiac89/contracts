import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { constants, Contract } from 'ethers'
import './utils/NumberExtensions'
import { hashEndingWith } from './utils/Common'

describe('Donut', () => {
  let donut: Contract
  let owner: SignerWithAddress
  let creator: SignerWithAddress
  let referrer: SignerWithAddress

  beforeEach(async () => {
    ;[owner, creator, referrer] = await ethers.getSigners()
    const donutFactory = await ethers.getContractFactory('MockDonut')
    donut = await donutFactory.deploy()
    await donut.deployed()

    await donut.deposit({ value: (100).eth })

    donut = donut.connect(creator)
  })

  describe('placeBet', () => {
    it('throws error if bet amount is less than min', async () => {
      await expect(donut.placeBet(3, referrer.address, { value: (0.0001).eth })).to.be.revertedWith(
        'Donut: Bet amount is less than minimum'
      )
    })

    it('throws error if bet amount is more than max', async () => {
      await expect(donut.placeBet(3, referrer.address, { value: (1).eth })).to.be.revertedWith(
        'Donut: Bet amount is more than maximum'
      )
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
      await expect(donut.placeBet(3, referrer.address, { value: (0.02).eth }))
        .to.emit(donut, 'BetPlaced')
        .withArgs(0, 3, creator.address, (0.02).eth)
    })

    it('increments numBets', async () => {
      await donut.placeBet(2, referrer.address, { value: (0.02).eth })
      await donut.placeBet(3, referrer.address, { value: (0.02).eth })
      await donut.placeBet(4, referrer.address, { value: (0.02).eth })

      expect(await donut.numBets()).to.eq(3)
    })
  })

  describe('claim', () => {
    beforeEach(async () => {
      await donut.connect(owner).setBlockHash(hashEndingWith('f'))
    })

    it('throws error if bet was not created by the sender', async () => {
      await expect(donut.claim(0)).to.be.revertedWith('Donut: Nothing to claim')

      await donut.placeBet(15, referrer.address, { value: (0.02).eth })

      await expect(donut.connect(referrer).claim(0)).to.be.revertedWith('Donut: Nothing to claim')

      await expect(donut.claim(0)).to.emit(donut, 'BetClaimed') // works fine
    })

    it("throws error if player didn't win", async () => {
      await donut.placeBet(4, referrer.address, { value: (0.02).eth })

      await expect(donut.claim(0)).to.be.revertedWith("Donut: You didn't win")
    })

    it('throws error if block hash is 0 (when time is up to claim)', async () => {
      await donut.connect(owner).setBlockHash(hashEndingWith('0'))
      await donut.placeBet(0, referrer.address, { value: (0.02).eth })

      await expect(donut.claim(0)).to.be.revertedWith("Donut: You didn't win")

      await donut.connect(owner).setBlockHash(hashEndingWith('f0')) // works fine
      await donut.placeBet(0, referrer.address, { value: (0.02).eth })

      const reward = (0.02).eth.mul(15)

      await expect(await donut.claim(0)).to.changeEtherBalance(creator, reward.mul(95).div(100))
    })

    describe('if won', () => {
      beforeEach(async () => {
        await donut.placeBet(15, referrer.address, { value: (0.02).eth })
      })

      it('transfers the original amount times multiplier to the player, less fees', async () => {
        const reward = (0.02).eth.mul(15)

        await expect(await donut.claim(0)).to.changeEtherBalances(
          [creator, owner, referrer],
          [reward.mul(95).div(100), reward.mul(4).div(100), reward.mul(1).div(100)]
        )

        await donut.placeBet(15, constants.AddressZero, { value: (0.02).eth })

        await expect(await donut.claim(1)).to.changeEtherBalances(
          [creator, owner, referrer],
          [reward.mul(95).div(100), reward.mul(5).div(100), (0).eth]
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
        await donut.placeBet(15, referrer.address, { value: (0.02).eth })

        await expect(donut.claim(0)).to.emit(donut, 'BetClaimed').withArgs(0, referrer.address)
      })
    })
  })
})
