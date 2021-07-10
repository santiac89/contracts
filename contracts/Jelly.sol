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
  mapping(uint256 => JellyBet) public bets;

  uint16 public constant MAX_COMMISSION_RATE = 1000;

  uint16 public commissionRate = 500;
  uint16 public referralRate = 100;
  uint16 public cancellationFee = 100;

  uint256 public numBets = 0;

  uint256 public minBet = 0.01 ether;

  event BetCreated(uint256 id, address creator, JellyType bet, uint256 value);
  event BetCancelled(uint256 id);
  event BetAccepted(uint256 id, address joiner);
  event BetConcluded(uint256 id, address referrer, JellyType result);

  constructor(address _whirlpool) WhirlpoolConsumer(_whirlpool) {}

  function createBet(JellyType bet, address referrer) external payable nonReentrant notContract {
    require(msg.value >= minBet, "Jelly: Bet amount is lower than minimum bet amount");

    uint256 id = numBets;

    bets[id].creator = msg.sender;
    bets[id].value = msg.value;
    bets[id].bet = bet;

    referrers[msg.sender] = referrer;

    emit BetCreated(numBets, msg.sender, bet, msg.value);

    numBets += 1;
  }

  function cancelBet(uint256 id) external nonReentrant notContract {
    require(bets[id].creator == msg.sender, "Jelly: You didn't create this bet");

    uint256 fee = (bets[id].value * cancellationFee) / 10000;
    send(msg.sender, bets[id].value, fee, address(0));

    emit BetCancelled(id);
    delete bets[id];
  }

  function acceptBet(uint256 id, address referrer) external payable nonReentrant notContract {
    require(bets[id].value != 0, "Jelly: Bet is unavailable");
    require(bets[id].joiner == address(0), "Jelly: Bet is already accepted");
    require(msg.value == bets[id].value, "Jelly: Unfair bet");

    bets[id].joiner = msg.sender;
    referrers[msg.sender] = referrer;

    emit BetAccepted(id, bets[id].joiner);

    _requestRandomness(id);
  }

  function setFees(
    uint16 _commissionRate,
    uint16 _referralRate,
    uint16 _cancellationFee
  ) external onlyOwner {
    require(
      _commissionRate <= MAX_COMMISSION_RATE && _referralRate <= _commissionRate && _cancellationFee <= _commissionRate,
      "Jelly: Value exceeds max amount"
    );

    commissionRate = _commissionRate;
    referralRate = _referralRate;
    cancellationFee = _cancellationFee;
  }

  function setMinBet(uint256 val) external onlyOwner {
    minBet = val;
  }

  function concludeBet(uint256 id, JellyType result) internal {
    uint256 reward = bets[id].value * 2;
    uint256 fee = (reward * commissionRate) / 10000;
    address winner = result == bets[id].bet ? bets[id].creator : bets[id].joiner;

    send(winner, reward, fee, referrers[winner]);

    emit BetConcluded(id, referrers[winner], result);

    delete bets[id];
  }

  function _consumeRandomness(uint256 id, uint256 randomness) internal override {
    concludeBet(id, JellyType(randomness % 2));
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
