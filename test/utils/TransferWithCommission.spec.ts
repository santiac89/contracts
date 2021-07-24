import { ethers } from 'hardhat'
import { expect } from 'chai'
import '../helpers/NumberExtensions'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { TestTransferWithCommission as TransferWithCommission } from '../../types/TestTransferWithCommission'

describe('TransferWithCommission', () => {
  let transferUtil: TransferWithCommission
  let owner: SignerWithAddress
  let player: SignerWithAddress
  let referrer: SignerWithAddress

  beforeEach(async () => {
    ;[owner, player, referrer] = await ethers.getSigners()

    const transferUtilFactory = await ethers.getContractFactory('TestTransferWithCommission')
    transferUtil = (await transferUtilFactory.deploy()) as TransferWithCommission
    await transferUtil.deployed()

    await transferUtil.deposit({ value: (100).eth })
  })

  describe('send', () => {
    it('sends the amount to the recipient less fees', async () => {
      await expect(await transferUtil.testSend(player.address, (1).eth)).to.changeEtherBalances(
        [player, owner],
        [(0.95).eth, (0.05).eth]
      )
    })

    it('sends the amount to the recipient less fees and referral if referral is set', async () => {
      await transferUtil.setReferrer(player.address, referrer.address)
      await expect(await transferUtil.testSend(player.address, (1).eth)).to.changeEtherBalances(
        [transferUtil, player, owner, referrer],
        [(-1).eth, (0.95).eth, (0.04).eth, (0.01).eth]
      )
    })

    it('sends full amount to the recipient if fee is 0', async () => {
      await transferUtil.setFees(0, 0, 0)
      await transferUtil.setReferrer(player.address, referrer.address)
      await expect(await transferUtil.testSend(player.address, (1).eth)).to.changeEtherBalances(
        [transferUtil, player, owner, referrer],
        [(-1).eth, (1).eth, 0, 0]
      )
    })
  })

  describe('refund', () => {
    it('sends the amount to the recipient less fees', async () => {
      await expect(await transferUtil.testRefund(player.address, (1).eth)).to.changeEtherBalances(
        [transferUtil, player, owner],
        [(-1).eth, (0.99).eth, (0.01).eth]
      )
    })

    it('sends full amount to the recipient if fee is 0', async () => {
      await transferUtil.setFees(0, 0, 0)
      await expect(await transferUtil.testRefund(player.address, (1).eth)).to.changeEtherBalances(
        [transferUtil, player, owner],
        [(-1).eth, (1).eth, 0]
      )
    })
  })

  describe('setFees', () => {
    it('sets fees to the given amount', async () => {
      await transferUtil.setFees(1000, 800, 400)
      await transferUtil.setReferrer(player.address, referrer.address)
      await expect(await transferUtil.testSend(player.address, (1).eth)).to.changeEtherBalances(
        [transferUtil, player, owner, referrer],
        [(-1).eth, (0.9).eth, (0.02).eth, (0.08).eth]
      )
      await expect(await transferUtil.testRefund(player.address, (1).eth)).to.changeEtherBalances(
        [transferUtil, player, owner],
        [(-1).eth, (0.96).eth, (0.04).eth]
      )
    })

    it('throws error if fee is more than max allowed', async () => {
      await expect(transferUtil.setFees(1001, 200, 300)).to.be.revertedWith('Value exceeds maximum')
      await expect(transferUtil.setFees(200, 300, 300)).to.be.revertedWith('Value exceeds maximum')
    })
  })
})
