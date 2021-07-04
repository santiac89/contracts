import { ethers } from 'hardhat'
import { expect } from 'chai'
import { Contract } from '@ethersproject/contracts'
import { parseEther } from 'ethers/lib/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'

describe('Jelly', () => {
  let jelly: Contract
  let owner: SignerWithAddress
  let referrer: SignerWithAddress

  beforeEach(async () => {
    ;[owner, referrer] = await ethers.getSigners()

    const Jelly = await ethers.getContractFactory('Jelly')
    Jelly.connect(owner)
    jelly = await Jelly.deploy()
    await jelly.deployed()
  })

  describe('createBet', () => {
    it('should create a new bet', async () => {
      jelly.connect(owner)

      const createBetTx = await jelly.createBet(1, referrer.address, { value: parseEther('0.001') })
      await createBetTx.wait()

      const bet = await jelly.bets(0)
      expect({ ...bet }).to.deep.include({
        id: BigNumber.from(0),
        creator: owner.address,
        referrer: referrer.address,
        value: parseEther('0.001'),
        fruit: 1,
      })
    })
  })
})
