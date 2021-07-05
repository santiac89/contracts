// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./WhirlpoolConsumer.sol";

contract Jelly is WhirlpoolConsumer {
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

  uint16 public MAX_COMMISSION_RATE = 1000;
  uint16 public MAX_REFERRAL_RATE = 200;

  uint16 public commissionRate = 500;
  uint16 public referralRate = 100;
  uint16 public cancelFee = 100;

  uint64 public numBets = 0;

  uint256 public minBet = 0.01 ether;

  event BetCreated(uint64 indexed id, address indexed creator, JellyType bet, uint256 value);
  event BetCancelled(uint64 indexed id, address indexed creator, JellyType bet, uint256 value);
  event BetAccepted(uint64 indexed id, address indexed creator, JellyType bet, uint256 value, address indexed joiner);
  event BetConcluded(
    uint64 indexed id,
    address indexed creator,
    JellyType bet,
    uint256 value,
    address indexed joiner,
    address referrer,
    JellyType result
  );

  event Transfer(address to, uint256 amount);

  constructor(address _whirlpool) WhirlpoolConsumer(_whirlpool) {}

  function createBet(JellyType bet, address referrer) external payable {
    require(msg.value >= minBet, "Jelly: Bet amount is lower than minimum bet amount");

    uint64 id = numBets;

    bets[id].creator = msg.sender;
    bets[id].value = msg.value;
    bets[id].bet = bet;

    referrers[msg.sender] = referrer;

    emit BetCreated(numBets, msg.sender, bet, msg.value);

    numBets += 1;
  }

  function cancelBet(uint64 id) external {
    require(bets[id].creator == msg.sender, "Jelly: You didn't create this bet");

    uint256 fee = (bets[id].value * cancelFee) / 10000;
    require(send(msg.sender, bets[id].value, fee, address(0)), "Jelly: Cancel bet failed");

    emit BetCancelled(id, bets[id].creator, bets[id].bet, bets[id].value);
    delete bets[id];
  }

  function acceptBet(uint64 id, address referrer) external payable {
    require(bets[id].value != 0, "Jelly: Bet is unavailable");
    require(bets[id].joiner == address(0), "Jelly: Bet is already accepted");
    require(msg.value == bets[id].value, "Jelly: Unfair bet");

    bets[id].joiner = msg.sender;
    referrers[msg.sender] = referrer;

    emit BetAccepted(id, bets[id].creator, bets[id].bet, bets[id].value, bets[id].joiner);

    _requestRandomness(id);
  }

  function concludeBet(uint64 id, JellyType result) internal {
    require(bets[id].value != 0, "Jelly: Bet is unavailable");
    require(bets[id].joiner != address(0), "Jelly: Bet isn't already accepted");

    uint256 reward = bets[id].value * 2;
    uint256 fee = (reward * commissionRate) / 10000;
    address winner = result == bets[id].bet ? bets[id].creator : bets[id].joiner;

    require(send(winner, reward, fee, referrers[winner]), "Jelly: Reward failed");

    emit BetConcluded(id, bets[id].creator, bets[id].bet, bets[id].value, bets[id].joiner, referrers[winner], result);

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

  function setCancelRate(uint16 val) external onlyOwner {
    require(val <= MAX_REFERRAL_RATE, "Jelly: Value exceeds max amount");
    cancelFee = val;
  }

  function setMinBet(uint256 val) external onlyOwner {
    minBet = val;
  }

  modifier limitMax(uint16 val, uint16 max) {
    _;
  }

  function send(
    address to,
    uint256 amount,
    uint256 fee,
    address referrer
  ) internal returns (bool) {
    (bool sent, ) = to.call{ value: amount - fee }("");
    if (fee == 0) return sent;

    if (referrer != address(0)) {
      uint256 refBonus = (amount * referralRate) / 10000;
      (bool sentToRef, ) = referrer.call{ value: refBonus }("");
      if (sentToRef) fee -= refBonus;
      sent = sent && sentToRef;
    }

    (bool sentFee, ) = owner().call{ value: fee }("");
    return sent && sentFee;
  }
}
