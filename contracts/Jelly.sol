// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./WhirlpoolConsumer.sol";
import "./security/SafeEntry.sol";

contract Jelly is WhirlpoolConsumer, SafeEntry {
  using Address for address;

  enum JellyType {
    Strawberry,
    Watermelon
  }

  struct JellyBet {
    JellyType bet;
    address creator;
    address joiner;
    uint256 value;
  }

  mapping(address => address) public referrers;
  mapping(uint64 => JellyBet) public bets;

  uint16 public constant MAX_COMMISSION_RATE = 1000;

  uint16 public commissionRate = 500;
  uint16 public referralRate = 100;
  uint16 public cancellationFee = 100;

  uint64 public numBets = 0;

  uint256 public minBet = 0.01 ether;

  event BetCreated(uint64 id, address creator, JellyType bet, uint256 value);
  event BetCancelled(uint64 id);
  event BetAccepted(uint64 id, address joiner);
  event BetConcluded(uint64 id, address referrer, JellyType result);

  constructor(address _whirlpool) WhirlpoolConsumer(_whirlpool) {}

  function createBet(JellyType bet, address referrer) external payable nonReentrant notContract {
    require(msg.value >= minBet, "Jelly: Bet amount is lower than minimum bet amount");

    uint64 id = numBets;

    bets[id].creator = msg.sender;
    bets[id].value = msg.value;
    bets[id].bet = bet;

    referrers[msg.sender] = referrer;

    emit BetCreated(numBets, msg.sender, bet, msg.value);

    numBets += 1;
  }

  function cancelBet(uint64 id) external nonReentrant notContract {
    require(bets[id].creator == msg.sender, "Jelly: You didn't create this bet");

    uint256 fee = (bets[id].value * cancellationFee) / 10000;
    send(msg.sender, bets[id].value, fee, address(0));

    emit BetCancelled(id);
    delete bets[id];
  }

  function acceptBet(uint64 id, address referrer) external payable nonReentrant notContract {
    require(bets[id].value != 0, "Jelly: Bet is unavailable");
    require(bets[id].joiner == address(0), "Jelly: Bet is already accepted");
    require(msg.value == bets[id].value, "Jelly: Unfair bet");

    bets[id].joiner = msg.sender;
    referrers[msg.sender] = referrer;

    emit BetAccepted(id, bets[id].joiner);

    _requestRandomness(id);
  }

  function concludeBet(uint64 id, JellyType result) internal {
    require(bets[id].value != 0, "Jelly: Bet is unavailable");
    require(bets[id].joiner != address(0), "Jelly: Bet isn't already accepted");

    uint256 reward = bets[id].value * 2;
    uint256 fee = (reward * commissionRate) / 10000;
    address winner = result == bets[id].bet ? bets[id].creator : bets[id].joiner;

    send(winner, reward, fee, referrers[winner]);

    emit BetConcluded(id, referrers[winner], result);

    delete bets[id];
  }

  function _consumeRandomness(uint64 id, uint256 randomness) internal override {
    concludeBet(id, JellyType(randomness % 2));
  }

  function setCommissionRate(uint16 val) external onlyOwner {
    require(val <= MAX_COMMISSION_RATE, "Jelly: Value exceeds max amount");
    commissionRate = val;
  }

  function setReferralRate(uint16 val) external onlyOwner {
    require(val <= commissionRate, "Jelly: Value exceeds max amount");
    referralRate = val;
  }

  function setCancellationFee(uint16 val) external onlyOwner {
    require(val <= commissionRate, "Jelly: Value exceeds max amount");
    cancellationFee = val;
  }

  function setMinBet(uint256 val) external onlyOwner {
    minBet = val;
  }

  function send(
    address to,
    uint256 amount,
    uint256 fee,
    address referrer
  ) internal {
    Address.sendValue(payable(to), amount - fee);
    if (fee == 0) return;

    if (referrer != address(0)) {
      uint256 refBonus = (amount * referralRate) / 10000;

      Address.sendValue(payable(referrer), refBonus);
      fee -= refBonus;
    }

    Address.sendValue(payable(owner()), fee);
  }
}
