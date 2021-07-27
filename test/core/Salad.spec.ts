import { ethers, waffle } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, constants, ContractTransaction } from 'ethers'
import IWhirlpool from '../../artifacts/contracts/utils/interfaces/IWhirlpool.sol/IWhirlpool.json'
import { MockContract } from 'ethereum-waffle'
import '../helpers/NumberExtensions'
import { fastForward, snapshot } from '../helpers/Common'
import { Salad } from '../../types/Salad'

describe('Salad', () => {
  let salad: Salad
  let owner: SignerWithAddress
  let players: SignerWithAddress[]
  let referrers: SignerWithAddress[]
  let mockIWhirlpool: MockContract

  const allBets = () => {
    let i = 0
    const bet = (value: number, bet: number, bet2: number) => ({
      value: value.eth,
      bet,
      bet2,
      player: players[i],
      referrer: referrers[i++]
    })

    // prettier-ignore
    return [
      bet(0.653, 0, 5), bet(0.133, 1, 3), bet(0.311, 4, 5), bet(0.682, 2, 3), bet(0.019, 5, 1),
      bet(0.322, 2, 3), bet(0.201, 1, 2), bet(0.161, 5, 3), bet(0.594, 2, 3), bet(0.004, 4, 0),
      bet(0.581, 0, 3), bet(0.694, 5, 5), bet(0.253, 1, 3), bet(0.216, 0, 5), bet(0.323, 0, 3),
      bet(0.978, 5, 2), bet(0.557, 0, 0), bet(0.605, 2, 0), bet(0.223, 0, 0), bet(0.058, 0, 2),
      bet(0.069, 2, 3), bet(0.285, 5, 1), bet(0.407, 0, 4), bet(0.126, 4, 1), bet(0.386, 3, 2)
    ]
  }

  const highestBet = () => allBets()[15]
  const bets = (n: number) => allBets().filter(({ bet }) => n === bet)
  const betCount = (n: number) => bets(n).length.wei
  const betSum = (n: number) =>
    bets(n)
      .map(({ value }) => value)
      .reduce((a, b) => a.add(b), (0).wei)

  const totalSum = () =>
    new Array(6)
      .fill('')
      .map((_, i) => betSum(i))
      .reduce((a, b) => a.add(b))

  const placeAllBets = async () => {
    await salad.connect(owner).setMinValue((0.001).eth)

    for (const { value, bet, bet2, player, referrer } of allBets()) {
      await salad.connect(player).addIngredient(0, bet, bet2, referrer.address, { value })
    }
  }

  async function increaseAllBets(n: BigNumber) {
    for (const player of players) {
      await salad.connect(player).increaseIngredient(0, 2, { value: n })
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

    const saladFactory = await ethers.getContractFactory('Salad')
    salad = (await saladFactory.deploy(mockIWhirlpool.address)) as Salad
    await salad.enableWhirlpool()

    salad = salad.connect(players[0])
  })

  describe('addIngredient', () => {
    it('throws error if not betting on the current salad', async () => {
      await expect(salad.addIngredient(1, 1, 3, referrers[0].address, { value: (0.1).eth })).to.be.revertedWith(
        'Not current salad'
      )
    })

    it('throws error if salad status is not BowlCreated', async () => {
      await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })
      await fastForward((1).day)
      await salad.prepareSalad(0)

      await expect(
        salad.connect(players[1]).addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })
      ).to.be.revertedWith('Already prepared')
    })

    it('throws error if bet is for anything other than 0-5', async () => {
      const msg = 'function was called with incorrect parameters'

      await expect(salad.addIngredient(0, 1, 7, referrers[0].address, { value: (0.1).eth })).to.be.revertedWith(msg)
      await expect(salad.addIngredient(0, 7, 1, referrers[0].address, { value: (0.1).eth })).to.be.revertedWith(msg)
      await expect(salad.addIngredient(0, 7, 7, referrers[0].address, { value: (0.1).eth })).to.be.revertedWith(msg)
    })

    it('throws error if a bet is already placed by the player', async () => {
      await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })

      await expect(salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })).to.be.revertedWith(
        'Already placed bet'
      )
    })

    it('throws error if time is up to place bet on this salad', async () => {
      await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })
      await fastForward((1).day)
      await expect(
        salad.connect(players[1]).addIngredient(0, 1, 3, referrers[1].address, { value: (0.1).eth })
      ).to.be.revertedWith('Time is up!')
    })

    it('throws error if bet amount is less than min bet', async () => {
      await expect(salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.001).eth })).to.be.revertedWith(
        'Less than minimum'
      )
    })

    it("adds player's bet to the list of bets", async () => {
      await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })

      const bet = await salad.saladBets(0, players[0].address)
      expect({ ...bet }).to.deep.include({
        bet: 1,
        bet2: 3,
        value: (0.1).eth
      })
    })

    it('increases total for each added bet, total sum and updates highest better', async () => {
      await placeAllBets()

      expect(await salad.sum(0)).to.eq(totalSum())

      for (let i = 0; i < 6; i++) {
        expect(await salad.betSum(0, i)).to.eq(betSum(i))
      }

      expect({ ...(await salad.salads(0)) }).to.deep.include({
        maxBet: highestBet().value,
        maxBetter: highestBet().player.address
      })
    })

    it('creates a new salad for first bet', async () => {
      await snapshot(async t => {
        await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })

        expect(await salad.currentSalad()).to.eq(0)

        const s = await salad.salads(0)
        expect(s.createdOn).to.eq(t)
        expect(s.expiresOn).to.eq(t + (1).day)
      })
    })

    it('emits a SaladBowlCreated event for first time salads', async () => {
      await snapshot(async t => {
        await expect(salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth }))
          .to.emit(salad, 'SaladBowlCreated')
          .withArgs(0, t + (1).day)
      })
    })

    it('emits a IngredientAdded event', async () => {
      await expect(salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth }))
        .to.emit(salad, 'IngredientAdded')
        .withArgs(0, players[0].address, 1, 3, (0.1).eth)
    })
  })

  describe('increaseIngredient', () => {
    it('throws error if salad status is not BowlCreated', async () => {
      await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })
      await fastForward((1).day)
      await salad.prepareSalad(0)

      await expect(salad.increaseIngredient(0, 5, { value: (0.1).eth })).to.be.revertedWith('Already prepared')
    })

    it('throws error if time is up to place bet on this salad', async () => {
      await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })
      await fastForward((1).day)
      await expect(salad.connect(players[0]).increaseIngredient(0, 5, { value: (0.1).eth })).to.be.revertedWith(
        'Time is up!'
      )
    })

    it('throws error if bet amount is 0', async () => {
      await expect(salad.increaseIngredient(0, 5)).to.be.revertedWith('Value must be more than 0')
    })

    it('throws error if no bet was placed by the player', async () => {
      await expect(salad.connect(players[1]).increaseIngredient(0, 5, { value: (0.1).eth })).to.be.revertedWith(
        'No bet placed yet'
      )
    })

    it("increases the player's bet amount", async () => {
      await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })
      await salad.increaseIngredient(0, 5, { value: (0.1).eth })

      const bet = await salad.saladBets(0, players[0].address)
      expect(bet.value).to.eq((0.2).eth)
    })

    it("updates player's bet2", async () => {
      await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })
      let bet = await salad.saladBets(0, players[0].address)
      expect(bet.bet2).to.eq(3)

      await salad.increaseIngredient(0, 2, { value: (0.1).eth })

      bet = await salad.saladBets(0, players[0].address)
      expect(bet.bet2).to.eq(2)
    })

    it('emits a IngredientIncreased event', async () => {
      await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.15).eth })
      await expect(salad.increaseIngredient(0, 5, { value: (0.11).eth }))
        .to.emit(salad, 'IngredientIncreased')
        .withArgs(0, players[0].address, 5, (0.26).eth)
    })

    it('increases total for each added bet, total sum and updates highest better', async () => {
      await placeAllBets()
      await increaseAllBets((0.4).eth)

      expect(await salad.sum(0)).to.eq(totalSum().add((10).eth))

      for (let i = 0; i < 6; i++) {
        const expected = betSum(i).add(betCount(i).mul((0.4).eth))
        expect(await salad.betSum(0, i)).to.eq(expected)
      }

      expect({ ...(await salad.salads(0)) }).to.deep.include({
        maxBet: highestBet().value.add((0.4).eth),
        maxBetter: highestBet().player.address
      })
    })
  })

  describe('prepareSalad', () => {
    beforeEach(async () => {
      await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })
    })

    it('throws error if time is not yet up for this salad', async () => {
      await fastForward((12).hours)

      await expect(salad.prepareSalad(0)).to.be.revertedWith('Time is not up yet!')
    })

    it('throws error if salad status is already Prepared', async () => {
      await fastForward((1).day)
      await salad.prepareSalad(0)

      await expect(salad.prepareSalad(0)).to.be.revertedWith('Already prepared')
    })

    it('sets salad status to Prepared', async () => {
      await fastForward((1).day)
      await salad.prepareSalad(0)

      expect((await salad.salads(0)).status).to.eq(1) // Prepared
    })

    it('emits a SaladPrepared event', async () => {
      await fastForward((1).day)

      await expect(salad.prepareSalad(0)).to.emit(salad, 'SaladPrepared').withArgs(0)
    })

    describe('on salad served', () => {
      let txPromise: Promise<ContractTransaction>
      let tx: ContractTransaction
      let time: number

      beforeEach(async () => {
        await fastForward((1).day)
        await salad.prepareSalad(0)

        await snapshot(async t => {
          txPromise = salad.connect(owner).consumeRandomness(constants.HashZero, 5)
          tx = await txPromise
          time = t
        })
      })

      it('sets status and result on salad', async () => {
        expect({ ...(await salad.salads(0)) }).to.deep.include({
          result: 5,
          status: 2 // Served
        })
      })

      it('creates a new salad', async () => {
        expect(await salad.currentSalad()).to.eq(1)

        const s = await salad.salads(1)
        expect(s.createdOn).to.eq(time)
        expect(s.expiresOn).to.eq(time + (1).day)
      })

      it('emits a SaladBowlCreated event (for the new salad)', async () => {
        await expect(txPromise)
          .to.emit(salad, 'SaladBowlCreated')
          .withArgs(1, time + (1).day)
      })

      it('emits a SaladServed event', async () => {
        await expect(txPromise).to.emit(salad, 'SaladServed').withArgs(0, 5)
      })
    })
  })

  describe('claim', () => {
    it('throws error if salad status is not Served; process claim otherwise', async () => {
      await salad.addIngredient(0, 1, 3, constants.AddressZero, { value: (0.1).eth })

      await expect(salad.claim(0)).to.be.revertedWith('Not ready to serve yet')

      await fastForward((1).day)
      await salad.prepareSalad(0)

      await expect(salad.claim(0)).to.be.revertedWith('Not ready to serve yet')

      await salad.connect(owner).consumeRandomness(constants.HashZero, 4)

      await expect(await salad.claim(0)).to.changeEtherBalances(
        [salad, owner, players[0]],
        [(-0.1).eth, (0.1).eth.mul(5).div(100), (0.1).eth.mul(95).div(100)]
      )
    })

    it("throws error if player didn't place any bets", async () => {
      await salad.addIngredient(0, 1, 3, constants.AddressZero, { value: (0.1).eth })
      await fastForward((1).day)
      await salad.prepareSalad(0)
      await salad.connect(owner).consumeRandomness(constants.HashZero, 4)

      await expect(salad.connect(players[1]).claim(0)).to.be.revertedWith('Nothing to claim')
    })

    describe('when salad is served; no jackpot', () => {
      beforeEach(async () => {
        await placeAllBets()
        await fastForward((1).day)
        await salad.prepareSalad(0)

        // result = 4
        await salad.connect(owner).consumeRandomness(constants.HashZero, 4)
      })

      it("throws error if the player didn't win", async () => {
        const losers = allBets()
          .filter(({ bet }) => bet === 4)
          .map(({ player }) => player)

        for (const player of losers) {
          await expect(salad.connect(player).claim(0)).to.be.revertedWith("You didn't win!")
        }
      })

      it('gives out appropriate reward for all other players', async () => {
        const winners = allBets().filter(({ bet }) => bet !== 4)

        const losersPot = betSum(4).div(5)
        for (const { bet, value, player, referrer } of winners) {
          const reward = betSum(bet).add(losersPot).mul(value).div(betSum(bet))
          await expect(await salad.connect(player).claim(0)).to.changeEtherBalances(
            [salad, player, owner, referrer],
            [
              reward.mul(-1),
              reward.sub(reward.mul(5).div(100)), // 95%
              reward.mul(5).div(100).sub(reward.mul(1).div(100)), // 4%
              reward.mul(1).div(100)
            ]
          )
        }
      })

      it('emits a Claimed event', async () => {
        const winners = allBets().filter(({ bet }) => bet !== 4)

        const losersPot = betSum(4).div(5)
        for (const { bet, value, player, referrer } of winners) {
          const reward = betSum(bet).add(losersPot).mul(value).div(betSum(bet))
          await expect(salad.connect(player).claim(0))
            .to.emit(salad, 'Claimed')
            .withArgs(0, player.address, reward, referrer.address)
        }
      })

      it('throws error if player tries to claim twice', async () => {
        const winners = allBets().filter(({ bet }) => bet !== 4)

        for (const { player } of winners) {
          await salad.connect(player).claim(0)

          await expect(salad.connect(player).claim(0)).to.be.revertedWith('Nothing to claim')
        }
      })
    })

    describe('when salad is served; jackpot', () => {
      beforeEach(async () => {
        await placeAllBets()
        await fastForward((1).day)
        await salad.prepareSalad(0)

        // result = 2
        await salad.connect(owner).consumeRandomness(constants.HashZero, 2)
      })

      it("throws error for all players except higher bidder that they didn't win", async () => {
        const remainingPlayers = allBets()
          .map(({ player }) => player)
          .filter(p => p != highestBet().player)

        for (const player of remainingPlayers) {
          await expect(salad.connect(player).claim(0)).to.be.revertedWith("You didn't win!")
        }
      })

      it('transfers total salad value to the jackpot winner less commission and referral fees', async () => {
        const { player, referrer } = highestBet()

        await expect(await salad.connect(player).claim(0)).to.changeEtherBalances(
          [salad, player, owner, referrer],
          [totalSum().mul(-1), totalSum().mul(95).div(100), totalSum().mul(4).div(100), totalSum().mul(1).div(100)]
        )
      })

      it('emits a Claimed event when the jackpot winner claims', async () => {
        const { player, referrer } = highestBet()

        await expect(await salad.connect(player).claim(0))
          .to.emit(salad, 'Claimed')
          .withArgs(0, player.address, totalSum(), referrer.address)
      })

      it('throws error if jackpot winner tries to claim twice', async () => {
        const { player } = highestBet()

        await salad.connect(player).claim(0) // works fine

        await expect(salad.connect(player).claim(0)).to.be.revertedWith('Nothing to claim')
      })
    })
  })

  describe('setExpiry', () => {
    const error = 'Time is not up yet!'

    it('throws error if expiry is out of bounds', async () => {
      await expect(salad.connect(owner).setExpiry((30).minutes)).to.be.revertedWith('Value is out of bounds')
      await expect(salad.connect(owner).setExpiry((5).days)).to.be.revertedWith('Value is out of bounds')
    })

    it('sets expiry of the new salads', async () => {
      await salad.connect(owner).setExpiry((1).hour)
      await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })

      await expect(salad.prepareSalad(0)).to.be.revertedWith(error)

      await fastForward((1).hour)

      await expect(salad.prepareSalad(0)).not.to.be.revertedWith(error)
    })

    it('does not affect expiry of existing salads', async () => {
      await salad.addIngredient(0, 1, 3, referrers[0].address, { value: (0.1).eth })
      await salad.connect(owner).setExpiry((1).hour)

      await expect(salad.prepareSalad(0)).to.be.revertedWith(error)

      await fastForward((1).hour)

      await expect(salad.prepareSalad(0)).to.be.revertedWith(error)

      await fastForward((23).hours)

      await expect(salad.prepareSalad(0)).not.to.be.revertedWith(error)
    })
  })
})
