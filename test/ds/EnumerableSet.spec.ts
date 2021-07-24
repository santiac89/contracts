import { ethers } from 'hardhat'
import { expect } from 'chai'
import { Contract } from 'ethers'
import '../helpers/NumberExtensions'
import { randomAddress, randomAddresses } from '../helpers/Random'

describe('EnumerableSet', () => {
  let set: Contract

  async function enumerate() {
    const size = await set.size()
    const arr: string[] = []
    for (let i = 0; i < size; i++) {
      arr.push(await set.get(i))
    }
    return arr
  }

  beforeEach(async () => {
    const setFactory = await ethers.getContractFactory('TestEnumerableSet')
    set = await setFactory.deploy()
    await set.deployed()
  })

  describe('add', () => {
    it('adds items to the set just once', async () => {
      const arr = randomAddresses(5)
      for (let i = 0; i < arr.length; i++) {
        await set.add(arr[i])

        // doesn't add the same address twice
        await set.add(arr[i])

        expect(await set.size()).to.eq(i + 1)
      }

      expect(await enumerate()).to.eql(arr)
    })
  })

  describe('removeAt', () => {
    it('removes item at an index from the set', async () => {
      const arr = randomAddresses(10)

      for (let i = 0; i < arr.length; i++) {
        await set.add(arr[i])
      }

      for (let i = 0; i < 5; i++) {
        arr.shift()
        await set.removeAt(0)

        expect(await enumerate()).to.eql(arr)
      }

      // removal at random indexes; order is not guaranteed, so we sort
      await set.removeAt(3) // 4 left
      arr.splice(3, 1)

      expect((await enumerate()).sort()).to.eql(arr.sort())

      let item = await set.get(1)
      await set.removeAt(1) // 3 left
      arr.splice(arr.indexOf(item), 1)

      expect((await enumerate()).sort()).to.eql(arr.sort())

      item = await set.get(2)
      await set.removeAt(2) // 2 left
      arr.splice(arr.indexOf(item), 1)

      expect((await enumerate()).sort()).to.eql(arr.sort())

      item = await set.get(0)
      await set.removeAt(0) // 1 left
      arr.splice(arr.indexOf(item), 1)

      expect((await enumerate()).sort()).to.eql(arr.sort())

      item = await set.get(0)
      await set.removeAt(0) // 0 left
      arr.splice(arr.indexOf(item), 1)

      expect((await enumerate()).sort()).to.eql(arr.sort())
    })

    it('does not remove anything if index is out of bounds', async () => {
      const arr = randomAddresses(5)

      for (let i = 0; i < arr.length; i++) {
        await set.add(arr[i])
      }

      await set.removeAt(5) // does nothing

      expect(await enumerate()).to.eql(arr)

      await set.removeAt(4) // works

      expect((await enumerate()).sort()).to.eql(arr.slice(0, -1).sort())
    })
  })

  describe('remove', () => {
    it('removes the given element from the array', async () => {
      const arr = randomAddresses(5)

      for (let i = 0; i < arr.length; i++) {
        await set.add(arr[i])
      }

      // removal of random items; order is not guaranteed, so we sort
      expect(await set.has(arr[3])).to.eq(true)
      await set.remove(arr[3]) // 4 left
      arr.splice(3, 1)

      expect((await enumerate()).sort()).to.eql(arr.sort())

      expect(await set.has(arr[1])).to.eq(true)
      await set.remove(arr[1]) // 3 left
      arr.splice(1, 1)

      expect((await enumerate()).sort()).to.eql(arr.sort())

      expect(await set.has(arr[2])).to.eq(true)
      await set.remove(arr[2]) // 2 left
      arr.splice(2, 1)

      expect((await enumerate()).sort()).to.eql(arr.sort())

      expect(await set.has(arr[0])).to.eq(true)
      await set.remove(arr[0]) // 1 left
      arr.splice(0, 1)

      expect((await enumerate()).sort()).to.eql(arr.sort())

      expect(await set.has(arr[0])).to.eq(true)
      await set.remove(arr[0]) // 0 left
      arr.splice(0, 1)

      expect((await enumerate()).sort()).to.eql(arr.sort())
    })

    it("does nothing if you try to remove an address that doesn't exist", async () => {
      const arr = randomAddresses(5)

      for (let i = 0; i < arr.length; i++) {
        await set.add(arr[i])
      }

      await set.remove(randomAddress()) // does nothing
      await set.remove(randomAddress())
      await set.remove(randomAddress())

      expect(await enumerate()).to.eql(arr)

      await set.remove(arr[4]) // works

      expect((await enumerate()).sort()).to.eql(arr.slice(0, -1).sort())
    })
  })
})
