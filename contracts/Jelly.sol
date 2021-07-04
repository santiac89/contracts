// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Jelly is Ownable {
  enum JellyType {
    Strawberry,
    Watermelon
  }

  struct JellyBetResult {
    address joiner;
    uint256 time;
    JellyType fruit;
  }

  struct JellyBet {
    uint256 id;
    address creator;
    address referrer;
    uint256 value;
    uint256 time;
    JellyType fruit;
    JellyBetResult result;
  }

  JellyBet[] public bets;

  uint256 MAX_COMMISSION_RATE = 1000;
  uint256 MAX_REFERRAL_RATE = 200;

  uint256 private _commission;
  uint256 public _commissionRate = 500;
  uint256 public _referralRate = 100;
  uint256 public _cancelFee = 100;

  uint256 public _minBet = 0;

  event BetCreated(uint256 id, address indexed creator, JellyType fruit, uint256 value, uint256 time);
  event BetCancelled(uint256 id, address indexed creator, JellyType fruit, uint256 value);
  event BetAccepted(
    uint256 id,
    address indexed creator,
    address indexed joiner,
    address indexed referrer,
    JellyType fruit,
    JellyType result,
    uint256 value,
    uint256 time
  );

  function createBet(JellyType fruit, address referrer)
    public
    payable
    walletsOnly
    nonZero
    minBet
    noSelfReferral(referrer)
  {
    uint256 id = bets.length;

    bets.push(
      JellyBet({
        id: id,
        creator: msg.sender,
        referrer: referrer,
        value: msg.value,
        fruit: fruit,
        time: block.timestamp,
        result: JellyBetResult({joiner: address(0), time: 0, fruit: JellyType.Strawberry})
      })
    );

    emit BetCreated(id, msg.sender, fruit, msg.value, block.timestamp);
  }

  function cancelBet(uint256 id) public payable betOwner(id) isAvailable(id) {
    JellyBet memory bet = bets[id];
    uint256 fee = (bet.value * _cancelFee) / 10000;
    require(send(msg.sender, bet.value, fee, address(0)), "Cancel bet failed");

    emit BetCancelled(id, msg.sender, bet.fruit, bet.value);
  }

  function acceptBet(uint256 id, address referrer)
    public
    payable
    walletsOnly
    isFair(id)
    isAvailable(id)
    noSelfReferral(referrer)
  {
    JellyBet storage bet = bets[id];
    uint256 fee = (bet.value * _commissionRate) / 10000;
    uint256 reward = bet.value + msg.value;
    JellyType result = pickJelly();

    address winner;
    if (result == bet.fruit) {
      referrer = bet.referrer;
      winner = bet.creator;
    } else {
      winner = msg.sender;
    }

    require(send(winner, reward, fee, referrer), "Reward failed");

    bet.result = JellyBetResult({joiner: msg.sender, time: block.timestamp, fruit: result});

    emit BetAccepted(id, bet.creator, msg.sender, referrer, bet.fruit, result, msg.value, block.timestamp);
  }

  function commission() public view onlyOwner returns (uint256) {
    return _commission;
  }

  function setTipRate(uint256 val) public onlyOwner limitMax(val, MAX_COMMISSION_RATE) {
    _commissionRate = val;
  }

  function setRefRate(uint256 val) public onlyOwner limitMax(val, _commissionRate) {
    _referralRate = val;
  }

  function setCancelRate(uint256 val) public onlyOwner limitMax(val, MAX_REFERRAL_RATE) {
    _cancelFee = val;
  }

  function setMinBet(uint256 val) public onlyOwner {
    _minBet = val;
  }

  modifier limitMax(uint256 val, uint256 max) {
    require(val <= max, "Value exceeds max amount");
    _;
  }

  modifier noSelfReferral(address referrer) {
    require(msg.sender != referrer, "Cannot refer self");
    _;
  }

  modifier nonZero() {
    require(msg.value > 0, "Cant bet for zero");
    _;
  }

  modifier minBet() {
    require(msg.value > _minBet, "Bet amount is lower than minimum bet amount");
    _;
  }

  modifier walletsOnly() {
    require(tx.origin == msg.sender, "Only wallets allowed");
    _;
  }

  modifier isAvailable(uint256 id) {
    require(bets[id].value > 0, "Bet is unavailable");
    _;
  }

  modifier isFair(uint256 id) {
    require(msg.value == bets[id].value, "Unfair bet");
    _;
  }

  modifier betOwner(uint256 id) {
    require(bets[id].creator == msg.sender, "You didn't create this bet");
    _;
  }

  function random() internal view returns (uint256) {
    return
      uint256(
        keccak256(abi.encodePacked(block.difficulty, block.timestamp, block.gaslimit, block.coinbase, block.number))
      );
  }

  function pickJelly() internal view returns (JellyType) {
    return JellyType(random() % 2);
  }

  function send(
    address to,
    uint256 amount,
    uint256 fee,
    address ref
  ) private returns (bool) {
    bool sent = transfer(to, amount - fee);
    if (fee == 0) return sent;

    if (ref != address(0)) {
      uint256 refBonus = amount * (_referralRate / 10000);
      bool sentToRef = transfer(ref, refBonus);
      if (sentToRef) fee -= refBonus;
    }

    bool sentFee = transfer(owner(), fee);
    _commission += fee;
    return sent && sentFee;
  }

  function transfer(address to, uint256 amount) private returns (bool) {
    (bool success, ) = to.call{value: amount}("");
    return success;
  }
}
