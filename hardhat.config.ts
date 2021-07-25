import { HardhatUserConfig } from 'hardhat/types'
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-gas-reporter'
import 'solidity-coverage'
import fs from 'fs'

function readFile(path: string) {
  if (fs.existsSync(path)) return fs.readFileSync(path).toString().trim()
}

const mnemonicTestnet = readFile('.secret.testnet')
const mnemonicMainnet = readFile('.secret.mainnet')
const mnemonicDefault = 'test test test test test test test test test test test junk'

const bscscanKey = readFile('.bscscan') || process.env.BSCSCAN_KEY
const coinmarketcapKey = readFile('.coinmarketcap') || process.env.COINMARKETCAP_KEY

const config: HardhatUserConfig = {
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545'
    },
    hardhat: {
      accounts: {
        count: 60
      }
    },
    testnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: 97,
      gasPrice: 20000000000,
      accounts: { mnemonic: mnemonicTestnet || mnemonicDefault }
    },
    mainnet: {
      url: 'https://bsc-dataseed.binance.org/',
      chainId: 56,
      gasPrice: 20000000000,
      accounts: { mnemonic: mnemonicMainnet || mnemonicDefault }
    }
  },
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true
      }
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },
  mocha: {
    timeout: 20000
  },
  etherscan: {
    apiKey: bscscanKey
  },
  typechain: {
    outDir: 'types',
    target: 'ethers-v5'
  },
  gasReporter: {
    currency: 'USD',
    coinmarketcap: coinmarketcapKey,
    outputFile: 'coverage/gas-report.txt',
    noColors: true
  }
}

export default config
