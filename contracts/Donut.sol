// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Donut is Ownable {
  uint8 public constant MAX_MULTIPLIER = 16;
  uint8 public multiplier = 15;

  uint256 public minBet = 0.001 ether;
  uint256 public maxBet = 0.1 ether;

  struct DonutBet {
    uint8 bet;
    address creator;
    uint256 value;
    uint256 block;
  }

  mapping(uint64 => DonutBet) public bets;

  uint64 public numBets = 0;

  event BetPlaced(uint64 id, uint8 bet, address creator, uint256 value, uint256 block);
  event BetClaimed(uint64 id);

  function hasWon(uint64 id) public view returns (bool) {
    if (bets[id].value == 0) return false;

    bytes32 hash = blockhash(bets[id].block);

    if (hash == bytes32(0)) return false;

    return uint8(hash[31]) % 16 == bets[id].bet;
  }

  function placeBet(uint8 bet) external payable {
    require(msg.value >= minBet, "Donut: Bet amount is less than minimum");
    require(msg.value <= maxBet, "Donut: Bet amount is greater than maximum");

    uint64 id = numBets;

    bets[id].bet = bet;
    bets[id].creator = msg.sender;
    bets[id].value = msg.value;
    bets[id].block = block.number;

    emit BetPlaced(id, bet, msg.sender, msg.value, block.number);

    numBets += 1;
  }

  function claim(uint64 id) external {
    require(bets[id].creator == msg.sender, "Donut: You didn't create this bet");
    require(hasWon(id), "Donut: You didn't win");
    require(send(bets[id].creator, bets[id].value * 15), "Donut: Claim failed");

    emit BetClaimed(id);

    delete bets[id];
  }

  function setMinBet(uint256 val) external onlyOwner {
    minBet = val;
  }

  function setMaxBet(uint256 val) external onlyOwner {
    maxBet = val;
  }

  function setMultiplier(uint8 val) external onlyOwner {
    require(val <= MAX_MULTIPLIER, "Donut: Value exceeds max amount");

    multiplier = val;
  }

  function deposit() external payable {}

  function withdraw(uint256 amount) external onlyOwner {
    send(owner(), amount);
  }

  function send(address to, uint256 amount) internal returns (bool) {
    (bool sent, ) = to.call{ value: amount }("");
    return sent;
  }
}
