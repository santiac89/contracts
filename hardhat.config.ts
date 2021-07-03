import { task } from 'hardhat/config'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'
import fs from 'fs'

function readFile(path: string) {
  if (fs.existsSync(path)) return fs.readFileSync(path).toString().trim()
}

const mnemonicTestnet = readFile('.secret.testnet')
const mnemonicMainnet = readFile('.secret.mainnet')
const mnemonicDefault = 'test test test test test test test test test test test junk'

const bscscanKey = readFile('.bscscan')

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (args, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  defaultNetwork: 'testnet',
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
    hardhat: {},
    testnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: 97,
      gasPrice: 20000000000,
      accounts: { mnemonic: mnemonicTestnet || mnemonicDefault },
    },
    mainnet: {
      url: 'https://bsc-dataseed.binance.org/',
      chainId: 56,
      gasPrice: 20000000000,
      accounts: { mnemonic: mnemonicMainnet || mnemonicDefault },
    },
  },
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: {
    timeout: 20000,
  },
  etherscan: {
    apiKey: bscscanKey,
  },
}
