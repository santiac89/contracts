// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/ValueLimits.sol";
import "../utils/TransferWithCommission.sol";

// prettier-ignore
enum DonutType { _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _A, _B, _C, _D, _E, _F }

struct DonutBet {
  DonutType bet;
  address creator;
  uint256 value;
  uint256 block;
}

contract Donut is TransferWithCommission, ValueLimits {
  uint256 public multiplier = 1500;

  uint256 public constant MAX_EXPIRY = 4 days;
  uint256 public constant MIN_EXPIRY = 5 minutes;

  mapping(uint256 => DonutBet) public bets;

  uint256 public numBets = 0;

  event BetPlaced(uint256 id, DonutType bet, address creator, uint256 value);
  event BetClaimed(uint256 id, address referrer);

  // solhint-disable no-empty-blocks
  constructor() ValueLimits(0.001 ether, 0.1 ether) {}

  function hasWon(uint256 id) public view returns (bool) {
    if (bets[id].value == 0) return false;

    bytes32 hash = getBlockHash(bets[id].block);

    if (hash == bytes32(0)) return false;

    return DonutType(uint8(hash[31]) % 16) == bets[id].bet;
  }

  function placeBet(DonutType bet, address referrer) external payable isMinValue isMaxValue {
    uint256 id = numBets;

    bets[id].bet = bet;
    bets[id].creator = msg.sender;
    bets[id].value = msg.value;
    bets[id].block = block.number;

    referrers[msg.sender] = referrer;

    emit BetPlaced(id, bet, msg.sender, msg.value);

    numBets += 1;
  }

  function claim(uint256 id) external {
    require(bets[id].creator == msg.sender, "Donut: Nothing to claim");
    require(hasWon(id), "Donut: You didn't win");

    uint256 sentAmount = (bets[id].value * multiplier) / 100;

    emit BetClaimed(id, referrers[msg.sender]);
    delete bets[id];

    send(payable(msg.sender), sentAmount);
  }

  function setMultiplier(uint256 val) external onlyOwner {
    multiplier = val;
  }

  // solhint-disable no-empty-blocks
  function deposit() external payable {}

  function withdraw(uint256 amount) external onlyOwner {
    // solhint-disable avoid-low-level-calls
    (bool success, ) = payable(owner()).call{ value: amount }("");

    require(success, "Donut: Withdraw failed");
  }

  function getBlockHash(uint256 blockNumber) internal view virtual returns (bytes32) {
    return blockhash(blockNumber);
  }
}
