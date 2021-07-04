// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./WhirlpoolConsumer.sol";

contract Jelly is WhirlpoolConsumer {
  enum JellyType {
    Strawberry,
    Watermelon
  }

  struct JellyBet {
    uint256 id;
    address creator;
    address creatorReferrer;
    uint256 value;
    bool cancelled;
    bool concluded;
    JellyType fruit;
    address joiner;
    address joinerReferrer;
    JellyType result;
  }

  JellyBet[] public bets;

  uint256 public MAX_COMMISSION_RATE = 1000;
  uint256 public MAX_REFERRAL_RATE = 200;

  uint256 internal _commission;

  uint256 public commissionRate = 500;
  uint256 public referralRate = 100;
  uint256 public cancelFee = 100;

  uint256 public minBet = 0.01 ether;

  event BetCreated(uint256 indexed id, address indexed creator, JellyType fruit, uint256 value);
  event BetCancelled(uint256 indexed id);
  event BetAccepted(uint256 indexed id, address indexed joiner);
  event BetConcluded(uint256 indexed id, JellyType result);

  event Transfer(address to, uint256 amount);

  constructor(IWhirlpool _whirlpool) WhirlpoolConsumer(_whirlpool) {}

  function createBet(JellyType fruit, address referrer)
    external
    payable
    onlyWallets
    nonZero
    isMinBet
    noSelfReferral(referrer)
  {
    uint256 id = bets.length;

    bets.push(
      JellyBet({
        id: id,
        creator: msg.sender,
        creatorReferrer: referrer,
        value: msg.value,
        fruit: fruit,
        cancelled: false,
        concluded: false,
        joiner: address(0),
        joinerReferrer: address(0),
        result: JellyType.Strawberry
      })
    );

    emit BetCreated(id, msg.sender, fruit, msg.value);
  }

  function cancelBet(uint256 id)
    external
    payable
    isAvailable(id)
    isntCancelled(id)
    isntAccepted(id)
    isntConcluded(id)
    betOwner(id)
  {
    uint256 fee = (bets[id].value * cancelFee) / 10000;
    require(send(msg.sender, bets[id].value, fee, address(0)), "Jelly: Cancel bet failed");

    bets[id].cancelled = true;

    emit BetCancelled(id);
  }

  function acceptBet(uint256 id, address referrer)
    external
    payable
    onlyWallets
    isAvailable(id)
    isntCancelled(id)
    isntAccepted(id)
    isntConcluded(id)
    isFair(id)
    noSelfReferral(referrer)
  {
    bets[id].joiner = msg.sender;
    bets[id].joinerReferrer = referrer;

    _requestRandomness(id);

    emit BetAccepted(id, msg.sender);
  }

  function concludeBet(uint256 id, JellyType result)
    internal
    isAvailable(id)
    isntCancelled(id)
    isAccepted(id)
    isntConcluded(id)
  {
    uint256 reward = bets[id].value * 2;
    uint256 fee = (reward * commissionRate) / 10000;
    address winner;
    address referrer;

    if (result == bets[id].fruit) {
      winner = bets[id].creator;
      referrer = bets[id].creatorReferrer;
    } else {
      winner = bets[id].joiner;
      referrer = bets[id].joinerReferrer;
    }

    require(send(winner, reward, fee, referrer), "Jelly: Reward failed");

    bets[id].concluded = true;
    bets[id].result = result;

    emit BetConcluded(id, result);
  }

  function _consumeRandomness(bytes32 requestId, uint256 randomness) internal override {
    concludeBet(activeRequests[requestId], JellyType(randomness % 2));
  }

  function commission() external view onlyOwner returns (uint256) {
    return _commission;
  }

  function setCommissionRate(uint256 val) external onlyOwner limitMax(val, MAX_COMMISSION_RATE) {
    commissionRate = val;
  }

  function setReferralRate(uint256 val) external onlyOwner limitMax(val, commissionRate) {
    referralRate = val;
  }

  function setCancelRate(uint256 val) external onlyOwner limitMax(val, MAX_REFERRAL_RATE) {
    cancelFee = val;
  }

  function setMinBet(uint256 val) external onlyOwner {
    minBet = val;
  }

  modifier limitMax(uint256 val, uint256 max) {
    require(val <= max, "Jelly: Value exceeds max amount");
    _;
  }

  modifier noSelfReferral(address referrer) {
    require(msg.sender != referrer, "Jelly: Cannot refer self");
    _;
  }

  modifier nonZero() {
    require(msg.value > 0, "Jelly: Bet amount cannot be 0");
    _;
  }

  modifier isMinBet() {
    require(msg.value >= minBet, "Jelly: Bet amount is lower than minimum bet amount");
    _;
  }

  modifier onlyWallets() {
    require(tx.origin == msg.sender, "Jelly: Only wallets allowed");
    _;
  }

  modifier isAvailable(uint256 id) {
    require(id >= 0 && id < bets.length, "Jelly: Bet is unavailable");
    _;
  }

  modifier isntCancelled(uint256 id) {
    require(!bets[id].cancelled, "Jelly: Bet is already cancelled");
    _;
  }

  modifier isntAccepted(uint256 id) {
    require(bets[id].joiner == address(0), "Jelly: Bet is already accepted");
    _;
  }

  modifier isAccepted(uint256 id) {
    require(bets[id].joiner != address(0), "Jelly: Bet isn't already accepted");
    _;
  }

  modifier isntConcluded(uint256 id) {
    require(!bets[id].concluded, "Jelly: Bet is already concluded");
    _;
  }

  modifier isFair(uint256 id) {
    require(msg.value == bets[id].value, "Jelly: Unfair bet");
    _;
  }

  modifier betOwner(uint256 id) {
    require(bets[id].creator == msg.sender, "Jelly: You didn't create this bet");
    _;
  }

  function send(
    address to,
    uint256 amount,
    uint256 fee,
    address referrer
  ) internal returns (bool) {
    bool sent = transfer(to, amount - fee);
    if (fee == 0) return sent;

    if (referrer != address(0)) {
      uint256 refBonus = (amount * referralRate) / 10000;
      bool sentToRef = transfer(referrer, refBonus);
      if (sentToRef) fee -= refBonus;

      bool _sentFee = transfer(owner(), fee);
      _commission += fee;
      return sent && sentToRef && _sentFee;
    }

    bool sentFee = transfer(owner(), fee);
    _commission += fee;
    return sent && sentFee;
  }

  function transfer(address to, uint256 amount) internal returns (bool) {
    (bool success, ) = to.call{ value: amount }("");
    emit Transfer(to, amount);
    return success;
  }
}
