import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract } from 'ethers'
import '../utils/NumberExtensions'
import { sorted } from '../utils/Common'
import { random } from '../utils/Random'

describe('RedBlackTree', () => {
  let rbt: Contract
  let owner: SignerWithAddress

  async function enumerate() {
    const arr = []
    for (let k: BigNumber = await rbt.first(); !k.eq(0); k = await rbt.next(k)) {
      arr.push(k)
    }
    return arr
  }

  async function enumerateReverse() {
    const arr = []
    for (let k: BigNumber = await rbt.last(); !k.eq(0); k = await rbt.prev(k)) {
      arr.push(k)
    }
    return arr
  }

  beforeEach(async () => {
    ;[owner] = await ethers.getSigners()
    const rbtFactory = await ethers.getContractFactory('TestRedBlackTree')
    rbt = await rbtFactory.deploy()
    await rbt.deployed()
  })

  describe('when there is no data', () => {
    it('returns 0 for all method calls', async () => {
      expect(await rbt.root()).to.eq(0)
      expect(await rbt.first()).to.eq(0)
      expect(await rbt.last()).to.eq(0)
      expect(await rbt.next(0)).to.eq(0)
      expect(await rbt.prev(0)).to.eq(0)
      expect(await rbt.exists(0)).to.eq(false)
    })
  })

  describe('insertion', () => {
    it('puts all items in proper order after insertion', async () => {
      const items = []
      for (let i = 0; i < 100; i++) {
        const item = random()!.eth

        items.push(item)
        await rbt.insert(item)
      }

      expect(await enumerate()).to.eql(sorted(items))
      expect(await enumerateReverse()).to.eql(sorted(items).reverse())
    })

    it('does not insert the same item twice', async () => {
      const i = (0.1).eth

      await rbt.insert(i)
      await rbt.insert(i)
      await rbt.insert(i)

      expect(await enumerate()).to.eql([i])
    })
  })

  describe('removal', () => {
    it('puts all items in proper order after deletion', async () => {
      let items = []
      for (let i = 0; i < 100; i++) {
        const item = random()!.eth

        items.push(item)
        await rbt.insert(item)
      }

      for (let i = 0; i < 50; i++) {
        await rbt.remove(items.shift())
      }

      expect(await enumerate()).to.eql(sorted(items))
      expect(await enumerateReverse()).to.eql(sorted(items).reverse())

      for (let i = 0; i < 49; i++) {
        await rbt.remove(items.shift())
      }

      expect(await enumerate()).to.eql(sorted(items))
      expect(await enumerateReverse()).to.eql(sorted(items).reverse())

      await rbt.remove(items.shift())

      expect(await enumerate()).to.eql([])
      expect(await enumerateReverse()).to.eql([])
    })

    it('does nothing when you try to remove an item that does not exist', async () => {
      const items = [(1).eth, (2).eth, (0.1).eth, (0.01).eth, (0.001).eth, (0.2).eth, (0.3).eth]

      for (const item of items) {
        await rbt.insert(item)
      }

      await rbt.remove((0.2793).eth)
      await rbt.remove((0.9979).eth)
      await rbt.remove((0.2353).eth)

      expect(await enumerate()).to.eql(sorted(items))
    })
  })
})
