import { BigNumber, constants } from 'ethers/lib/ethers'
import { ethers } from 'hardhat'
import './NumberExtensions'

export async function fastForward(t: number) {
  await ethers.provider.send('evm_increaseTime', [t])
  await ethers.provider.send('evm_mine', [])
}

export async function mineBlocks(n: number) {
  if (!n) return

  await ethers.provider.send('evm_mine', [])
  await mineBlocks(n - 1)
}

let t = Date.now().ms

export async function snapshot(callback: (t: number) => Promise<any>) {
  t += (1).year
  await ethers.provider.send('evm_setNextBlockTimestamp', [t])
  await callback(t)
}

export function hashEndingWith(s: string) {
  return constants.HashZero.replace(new RegExp(`0{1,${s.length}}$`), s)
}

export function sorted(arr: BigNumber[]) {
  return [...arr].sort((a, b) => {
    if (a.lt(b)) return -1
    if (a.gt(b)) return 1
    return 0
  })
}
