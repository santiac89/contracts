import { run, ethers } from 'hardhat'

export async function compile(name: string, ...args: any[]) {
  await run('compile')

  const Contract = await ethers.getContractFactory(name)
  const deployed = await Contract.deploy(...args)

  await deployed.deployed()

  console.log(`Contract "${name}" deployed to:`, deployed.address)
}
