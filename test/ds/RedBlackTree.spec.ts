import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import '../helpers/NumberExtensions'
import { sorted } from '../helpers/Common'
import { random } from '../helpers/Random'
import { TestRedBlackTree as RedBlackTree } from '../../types/TestRedBlackTree'

describe('RedBlackTree', () => {
  let tree: RedBlackTree
  let owner: SignerWithAddress

  async function enumerate() {
    const arr = []
    for (let k: BigNumber = await tree.first(); !k.eq(0); k = await tree.next(k)) {
      arr.push(k)
    }
    return arr
  }

  async function enumerateReverse() {
    const arr = []
    for (let k: BigNumber = await tree.last(); !k.eq(0); k = await tree.prev(k)) {
      arr.push(k)
    }
    return arr
  }

  beforeEach(async () => {
    ;[owner] = await ethers.getSigners()
    const treeFactory = await ethers.getContractFactory('TestRedBlackTree')
    tree = (await treeFactory.deploy()) as RedBlackTree
    await tree.deployed()
  })

  describe('when there is no data', () => {
    it('returns 0 for all method calls', async () => {
      expect(await tree.root()).to.eq(0)
      expect(await tree.first()).to.eq(0)
      expect(await tree.last()).to.eq(0)
      expect(await tree.next(0)).to.eq(0)
      expect(await tree.prev(0)).to.eq(0)
      expect(await tree.exists(0)).to.eq(false)
    })
  })

  describe('insertion', () => {
    it('puts all items in proper order after insertion', async () => {
      const items = []
      for (let i = 0; i < 100; i++) {
        const item = random()!.eth

        items.push(item)
        await tree.insert(item)
      }

      expect(await enumerate()).to.eql(sorted(items))
      expect(await enumerateReverse()).to.eql(sorted(items).reverse())
    })

    it('does not insert the same item twice', async () => {
      const i = (0.1).eth

      await tree.insert(i)
      await tree.insert(i)
      await tree.insert(i)

      expect(await enumerate()).to.eql([i])
    })
  })

  describe('removal', () => {
    it('puts all items in proper order after deletion', async () => {
      let items = []
      for (let i = 0; i < 100; i++) {
        const item = random()!.eth

        items.push(item)
        await tree.insert(item)
      }

      for (let i = 0; i < 50; i++) {
        await tree.remove(items.shift()!)
      }

      expect(await enumerate()).to.eql(sorted(items))
      expect(await enumerateReverse()).to.eql(sorted(items).reverse())

      for (let i = 0; i < 49; i++) {
        await tree.remove(items.shift()!)
      }

      expect(await enumerate()).to.eql(sorted(items))
      expect(await enumerateReverse()).to.eql(sorted(items).reverse())

      await tree.remove(items.shift()!)

      expect(await enumerate()).to.eql([])
      expect(await enumerateReverse()).to.eql([])
    })

    it('does nothing when you try to remove an item that does not exist', async () => {
      const items = [(1).eth, (2).eth, (0.1).eth, (0.01).eth, (0.001).eth, (0.2).eth, (0.3).eth]

      for (const item of items) {
        await tree.insert(item)
      }

      await tree.remove((0.2793).eth)
      await tree.remove((0.9979).eth)
      await tree.remove((0.2353).eth)

      expect(await enumerate()).to.eql(sorted(items))
    })
  })
})
