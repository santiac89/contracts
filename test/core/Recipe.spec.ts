import { ethers, waffle } from 'hardhat'
import { expect } from 'chai'
import IWhirlpool from '../../artifacts/contracts/utils/interfaces/IWhirlpool.sol/IWhirlpool.json'
import '../helpers/NumberExtensions'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { MockContract } from 'ethereum-waffle'
import { constants, ContractTransaction } from 'ethers'
import { TestRecipe as Recipe } from '../../types/TestRecipe'

describe('Recipe', () => {
  let recipe: Recipe
  let owner: SignerWithAddress
  let players: SignerWithAddress[]
  let referrers: SignerWithAddress[]
  let mockIWhirlpool: MockContract

  const allBids = () => {
    let i = 0
    const bid = (value: number) => ({
      value: value.eth,
      player: players[i],
      referrer: referrers[i++]
    })

    // prettier-ignore
    return [
      bid(0.653), bid(0.133), bid(0.311), bid(0.682), bid(0.019),
      bid(0.322), bid(0.201), bid(0.161), bid(0.594), bid(0.004),
      bid(0.581), bid(0.694), bid(0.253), bid(0.216), bid(0.323),
      bid(0.978), bid(0.557), bid(0.605), bid(0.223), bid(0.058),
      bid(0.069), bid(0.285), bid(0.407), bid(0.126), bid(0.386)
    ]
  }

  const highestBid = () => allBids()[15]
  const totalSum = () => allBids().reduce((a, b) => a.add(b.value), constants.Zero)

  const createBid = () => createBids(1)
  const createBids = async (n = 25) => {
    for (const { value, player, referrer } of allBids().slice(0, n)) {
      await recipe.connect(player).createBid(0, referrer.address, { value })
    }
  }

  beforeEach(async () => {
    const signers = await ethers.getSigners()
    owner = signers.shift()!
    players = signers.splice(0, 25)
    referrers = signers

    mockIWhirlpool = await waffle.deployMockContract(owner, IWhirlpool.abi)

    await mockIWhirlpool.mock.addConsumer.returns()
    await mockIWhirlpool.mock.request.returns(constants.HashZero)

    const recipeFactory = await ethers.getContractFactory('TestRecipe')
    recipe = (await recipeFactory.deploy(mockIWhirlpool.address)) as Recipe
    await recipe.enableWhirlpool()

    recipe = recipe.connect(players[0])
  })

  describe('createBid', () => {
    it('adds the bets to the list of bets', async () => {
      await createBids()
      // await createBids()
    })
  })
})
