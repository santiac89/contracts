// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./WhirlpoolConsumer.sol";
import "./security/SafeEntry.sol";
import "./utils/TransferWithCommission.sol";

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

contract Jelly is TransferWithCommission, WhirlpoolConsumer, SafeEntry {
  using Address for address;

  mapping(uint256 => JellyBet) public bets;

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

    refund(msg.sender, bets[id].value);

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

  function setMinBet(uint256 val) external onlyOwner {
    minBet = val;
  }

  function concludeBet(uint256 id, JellyType result) internal {
    address winner = result == bets[id].bet ? bets[id].creator : bets[id].joiner;

    send(winner, bets[id].value * 2);

    emit BetConcluded(id, referrers[winner], result);

    delete bets[id];
  }

  function _consumeRandomness(uint256 id, uint256 randomness) internal override {
    concludeBet(id, JellyType(randomness % 2));
  }
}
