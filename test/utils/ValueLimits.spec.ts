import { ethers } from 'hardhat'
import { expect } from 'chai'
import { Contract } from 'ethers'
import '../helpers/NumberExtensions'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

describe('ValueLimits', () => {
  let valueLimits: Contract
  let owner: SignerWithAddress
  let other: SignerWithAddress

  beforeEach(async () => {
    ;[owner, other] = await ethers.getSigners()

    const valueLimitsFactory = await ethers.getContractFactory('TestValueLimits')
    valueLimits = await valueLimitsFactory.deploy()
    await valueLimits.deployed()

    await valueLimits.deposit({ value: (1).eth })
  })

  describe('setMinValue', () => {
    it('sets min value for transfer to the contract', async () => {
      await valueLimits.setMinValue((10).eth)

      await expect(valueLimits.deposit({ value: (1).eth })).to.be.revertedWith('Less than minimum')
    })

    it('fails if caller is not the owner', async () => {
      await expect(valueLimits.connect(other).setMinValue((10).eth)).to.be.revertedWith('caller is not the owner')
    })
  })

  describe('setMaxValue', () => {
    it('sets max value for transfer to the contract', async () => {
      await valueLimits.setMaxValue((10).eth)

      await expect(valueLimits.deposit({ value: (11).eth })).to.be.revertedWith('More than maximum')
    })

    it('fails if caller is not the owner', async () => {
      await expect(valueLimits.connect(other).setMaxValue((10).eth)).to.be.revertedWith('caller is not the owner')
    })
  })
})
