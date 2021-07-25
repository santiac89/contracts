import { ethers } from 'hardhat'
import { expect } from 'chai'
import '../helpers/NumberExtensions'
import { random, randomAddress, randomAddresses } from '../helpers/Random'
import { TestEnumerableMap as EnumerableMap } from '../../types/TestEnumerableMap'
import { BigNumber } from 'ethers'

type Entry = { key: string; value: BigNumber }

function entries(list: string[]): Entry[] {
  return list.map(key => ({ key, value: random().eth }))
}

function sorted(entries: Entry[]) {
  return [...entries].sort((a, b) => {
    if (a.key < b.key) return -1
    if (a.key > b.key) return 1
    return 0
  })
}

function indexOf(entries: Entry[], key: string) {
  return entries.findIndex(e => e.key == key)
}

describe('EnumerableMap', () => {
  let map: EnumerableMap

  async function enumerate() {
    const size = await map.size()
    const arr: Entry[] = []
    for (let i = 0; i < size.toNumber(); i++) {
      const key = await map.at(i)
      arr.push({ key, value: await map.get(key) })
    }
    return arr
  }

  beforeEach(async () => {
    const mapFactory = await ethers.getContractFactory('TestEnumerableMap')
    map = (await mapFactory.deploy()) as EnumerableMap
    await map.deployed()
  })

  describe('set', () => {
    it('adds items to the map just once', async () => {
      const arr = entries(randomAddresses(5))
      for (let i = 0; i < arr.length; i++) {
        await map.set(arr[i].key, arr[i].value)

        // doesn't add the same address twice
        await map.set(arr[i].key, arr[i].value)

        expect(await map.size()).to.eq(i + 1)
      }

      expect(await enumerate()).to.eql(arr)
    })

    it('updates items in the map if they already exists', async () => {
      const arr = entries(randomAddresses(5))
      for (let i = 0; i < arr.length; i++) {
        await map.set(arr[i].key, arr[i].value)

        // doesn't add the same address twice, but updates the value
        await map.set(arr[i].key, arr[i].value.mul(2))

        expect(await map.size()).to.eq(i + 1)
      }

      expect(await enumerate()).to.eql(arr.map(({ key, value }) => ({ key, value: value.mul(2) })))
    })
  })

  describe('removeAt', () => {
    it('removes item at an index from the map', async () => {
      const arr = entries(randomAddresses(10))

      for (let i = 0; i < arr.length; i++) {
        await map.set(arr[i].key, arr[i].value)
      }

      for (let i = 0; i < 5; i++) {
        arr.shift()
        await map.removeAt(0)

        expect(await enumerate()).to.eql(arr)
      }

      // removal at random indexes; order is not guaranteed, so we sort
      await map.removeAt(3) // 4 left
      arr.splice(3, 1)

      expect(sorted(await enumerate())).to.eql(sorted(arr))

      let item = await map.at(1)
      await map.removeAt(1) // 3 left
      arr.splice(indexOf(arr, item), 1)

      expect(sorted(await enumerate())).to.eql(sorted(arr))

      item = await map.at(2)
      await map.removeAt(2) // 2 left
      arr.splice(indexOf(arr, item), 1)

      expect(sorted(await enumerate())).to.eql(sorted(arr))

      item = await map.at(0)
      await map.removeAt(0) // 1 left
      arr.splice(indexOf(arr, item), 1)

      expect(sorted(await enumerate())).to.eql(sorted(arr))

      item = await map.at(0)
      await map.removeAt(0) // 0 left
      arr.splice(indexOf(arr, item), 1)

      expect(sorted(await enumerate())).to.eql(sorted(arr))
    })

    it('does not remove anything if index is out of bounds', async () => {
      const arr = entries(randomAddresses(5))

      for (let i = 0; i < arr.length; i++) {
        await map.set(arr[i].key, arr[i].value)
      }

      await map.removeAt(5) // does nothing

      expect(await enumerate()).to.eql(arr)

      await map.removeAt(4) // works

      expect(sorted(await enumerate())).to.eql(sorted(arr.slice(0, -1)))
    })
  })

  describe('remove', () => {
    it('removes the given element from the array', async () => {
      const arr = entries(randomAddresses(10))

      for (let i = 0; i < arr.length; i++) {
        await map.set(arr[i].key, arr[i].value)
      }

      // removal of random items; order is not guaranteed, so we sort
      expect(await map.has(arr[3].key)).to.eq(true)
      await map.remove(arr[3].key) // 4 left
      arr.splice(3, 1)

      expect(sorted(await enumerate())).to.eql(sorted(arr))

      expect(await map.has(arr[1].key)).to.eq(true)
      await map.remove(arr[1].key) // 3 left
      arr.splice(1, 1)

      expect(sorted(await enumerate())).to.eql(sorted(arr))

      expect(await map.has(arr[2].key)).to.eq(true)
      await map.remove(arr[2].key) // 2 left
      arr.splice(2, 1)

      expect(sorted(await enumerate())).to.eql(sorted(arr))

      expect(await map.has(arr[0].key)).to.eq(true)
      await map.remove(arr[0].key) // 1 left
      arr.splice(0, 1)

      expect(sorted(await enumerate())).to.eql(sorted(arr))

      expect(await map.has(arr[0].key)).to.eq(true)
      await map.remove(arr[0].key) // 0 left
      arr.splice(0, 1)

      expect(sorted(await enumerate())).to.eql(sorted(arr))
    })

    it("does nothing if you try to remove an address that doesn't exist", async () => {
      const arr = entries(randomAddresses(5))

      for (let i = 0; i < arr.length; i++) {
        await map.set(arr[i].key, arr[i].value)
      }

      await map.remove(randomAddress()) // does nothing
      await map.remove(randomAddress())
      await map.remove(randomAddress())

      expect(await enumerate()).to.eql(arr)

      await map.remove(arr[4].key) // works

      expect(sorted(await enumerate())).to.eql(sorted(arr.slice(0, -1)))
    })
  })
})
