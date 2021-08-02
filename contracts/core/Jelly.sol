// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/ValueLimits.sol";
import "../utils/TransferWithCommission.sol";
import "../utils/WhirlpoolConsumer.sol";
import "../utils/WhitelistedTokens.sol";

enum JellyType {
  Strawberry,
  Watermelon
}

struct JellyBet {
  JellyType bet;
  address creator;
  address joiner;
  uint256 value;
  address token;
}

contract Jelly is TransferWithCommission, ValueLimits, WhirlpoolConsumer, WhitelistedTokens {
  mapping(uint256 => JellyBet) public bets;

  uint256 public numBets = 0;

  event BetCreated(uint256 id, address creator, address token, JellyType bet, uint256 value);
  event BetCancelled(uint256 id);
  event BetAccepted(uint256 id, address joiner);
  event BetConcluded(uint256 id, address referrer, JellyType result);

  // solhint-disable no-empty-blocks
  constructor(address _whirlpool) WhirlpoolConsumer(_whirlpool) ValueLimits(0.01 ether, 1000 ether) {}

  function createBet(JellyType bet, address referrer) external payable {
    createBetWithToken(address(0), msg.value, bet, referrer);
  }

  function createBetWithToken(
    address token,
    uint256 value,
    JellyType bet,
    address referrer
  ) public isMinTokenValue(value) isWhitelisted(token) {
    receiveToken(token, msg.sender, value);

    uint256 id = numBets;

    bets[id].creator = msg.sender;
    bets[id].value = value;
    bets[id].bet = bet;
    bets[id].token = token;

    referrers[msg.sender] = referrer;

    emit BetCreated(numBets, msg.sender, token, bet, value);

    numBets += 1;
  }

  function cancelBet(uint256 id) external {
    require(bets[id].creator == msg.sender, "Jelly: Not your bet");

    uint256 sentAmount = bets[id].value;

    emit BetCancelled(id);
    delete bets[id];

    refundToken(bets[id].token, msg.sender, sentAmount);
  }

  function _consumeRandomness(uint256 id, uint256 randomness) internal override {
    _concludeBet(id, JellyType(randomness % 2));
  }

  function acceptBet(uint256 id, address referrer) external payable {
    acceptBetWithToken(msg.value, id, referrer);
  }

  function acceptBetWithToken(
    uint256 value,
    uint256 id,
    address referrer
  ) public {
    require(bets[id].value != 0, "Jelly: Bet is unavailable");
    require(bets[id].joiner == address(0), "Jelly: Bet is already accepted");
    require(value == bets[id].value, "Jelly: Unfair bet");

    receiveToken(bets[id].token, msg.sender, value);

    bets[id].joiner = msg.sender;
    referrers[msg.sender] = referrer;

    emit BetAccepted(id, bets[id].joiner);

    _requestRandomness(id);
  }

  function _concludeBet(uint256 id, JellyType result) private {
    address winner = result == bets[id].bet ? bets[id].creator : bets[id].joiner;

    sendToken(bets[id].token, winner, bets[id].value * 2);

    emit BetConcluded(id, referrers[winner], result);

    delete bets[id];
  }
}
