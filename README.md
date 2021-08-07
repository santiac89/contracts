# Contracts for Juicy.bet games

[![Coverage Status](https://coveralls.io/repos/github/juicybet/contracts/badge.svg?branch=main)](https://coveralls.io/github/juicybet/contracts?branch=main)

---

**Juicy.bet** is a betting platform for Binance Smart Chain with 5 games. All of the games allow you to bet with BNB or any whitelisted token (like CAKE). The game uses Chainlink VRF for random number generation. All games have a common referral system where the referrer gets 1% of the winnings of the referral.

1. **Jelly:** Coin flip. Bet which fruit (strawberry or watermelon) will turn to Jelly.
2. **Donut:** Chain betting. Bet what the last character of the current block's hash will be.
3. **Salad:** Russian roulette, where one pool out of six gets eliminated each round. However if the highest bidder makes two guesses correctly, they take everything.
4. **Recipe:** A game of constant elimination. One person gets eliminated every 5 minutes and their rewards redistributed to the rest. However, if the highest bidder gets picked, they have a 25% chance of taking everything in the pool instead of getting eliminated.
5. **Vine:** A game of price prediction of BNB or any token like CAKE. Each prediction round lasts 24 hours. You have to bet whether the price will go up or down the current price in a particular range. However as more people keep betting, the range keeps shrinking, so you need to bet more to increase your range. At the end of the round, the winners get losers' money.

