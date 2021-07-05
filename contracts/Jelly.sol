// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./WhirlpoolConsumer.sol";

contract Jelly is WhirlpoolConsumer {
  enum JellyType {
    Strawberry,
    Watermelon
  }

  struct JellyBet {
    JellyType fruit;
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

  event BetCreated(uint64 indexed id, address indexed creator, JellyType fruit, uint256 value);
  event BetCancelled(uint64 indexed id, address indexed creator, JellyType fruit, uint256 value);
  event BetAccepted(uint64 indexed id, address indexed creator, JellyType fruit, uint256 value, address indexed joiner);
  event BetConcluded(
    uint64 indexed id,
    address indexed creator,
    JellyType fruit,
    uint256 value,
    address indexed joiner,
    address referrer,
    JellyType result
  );

  event Transfer(address to, uint256 amount);

  constructor(address _whirlpool) WhirlpoolConsumer(_whirlpool) {}

  function createBet(JellyType fruit, address referrer) external payable isMinBet {
    bets[numBets] = JellyBet({ creator: msg.sender, value: msg.value, fruit: fruit, joiner: address(0) });

    setReferrer(referrer);
    emit BetCreated(numBets, msg.sender, fruit, msg.value);
    numBets += 1;
  }

  function cancelBet(uint64 id) external isAvailable(id) betOwner(id) {
    uint256 fee = (bets[id].value * cancelFee) / 10000;
    require(send(msg.sender, bets[id].value, fee, address(0)), "Jelly: Cancel bet failed");

    emit BetCancelled(id, bets[id].creator, bets[id].fruit, bets[id].value);
    delete bets[id];
  }

  function acceptBet(uint64 id, address referrer) external payable isAvailable(id) isFair(id) isntAccepted(id) {
    bets[id].joiner = msg.sender;

    setReferrer(referrer);
    _requestRandomness(id);

    emit BetAccepted(id, bets[id].creator, bets[id].fruit, bets[id].value, bets[id].joiner);
  }

  function concludeBet(uint64 id, JellyType result) internal isAvailable(id) isAccepted(id) {
    uint256 reward = bets[id].value * 2;
    uint256 fee = (reward * commissionRate) / 10000;
    address winner = result == bets[id].fruit ? bets[id].creator : bets[id].joiner;

    require(send(winner, reward, fee, referrers[winner]), "Jelly: Reward failed");

    emit BetConcluded(id, bets[id].creator, bets[id].fruit, bets[id].value, bets[id].joiner, referrers[winner], result);

    delete bets[id];
  }

  function setReferrer(address referrer) internal {
    if (referrer != address(0)) referrers[msg.sender] = referrer;
  }

  function _consumeRandomness(uint64 id, uint256 randomness) internal override {
    concludeBet(id, JellyType(randomness % 2));
  }

  function setCommissionRate(uint16 val) external onlyOwner limitMax(val, MAX_COMMISSION_RATE) {
    commissionRate = val;
  }

  function setReferralRate(uint16 val) external onlyOwner limitMax(val, commissionRate) {
    referralRate = val;
  }

  function setCancelRate(uint16 val) external onlyOwner limitMax(val, MAX_REFERRAL_RATE) {
    cancelFee = val;
  }

  function setMinBet(uint256 val) external onlyOwner {
    minBet = val;
  }

  modifier limitMax(uint16 val, uint16 max) {
    require(val <= max, "Jelly: Value exceeds max amount");
    _;
  }

  modifier isMinBet() {
    require(msg.value >= minBet, "Jelly: Bet amount is lower than minimum bet amount");
    _;
  }

  modifier isAvailable(uint64 id) {
    require(bets[id].value != 0, "Jelly: Bet is unavailable");
    _;
  }

  modifier isntAccepted(uint64 id) {
    require(bets[id].joiner == address(0), "Jelly: Bet is already accepted");
    _;
  }

  modifier isAccepted(uint64 id) {
    require(bets[id].joiner != address(0), "Jelly: Bet isn't already accepted");
    _;
  }

  modifier isFair(uint64 id) {
    require(msg.value == bets[id].value, "Jelly: Unfair bet");
    _;
  }

  modifier betOwner(uint64 id) {
    require(bets[id].creator == msg.sender, "Jelly: You didn't create this bet");
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
