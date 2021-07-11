// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./security/SafeEntry.sol";

contract Donut is Ownable, SafeEntry {
  using Address for address;

  uint8 public constant MIN_MULTIPLIER = 10;
  uint8 public constant MAX_MULTIPLIER = 20;
  uint8 public multiplier = 15;

  uint16 public constant MAX_COMMISSION_RATE = 1000;
  uint256 public MAX_EXPIRY = 4 days;
  uint256 public MIN_EXPIRY = 5 minutes;

  uint16 public commissionRate = 500;
  uint16 public referralRate = 100;

  uint256 public minBet = 0.001 ether;
  uint256 public maxBet = 0.1 ether;

  struct DonutBet {
    uint8 bet;
    address creator;
    uint256 value;
    uint256 block;
  }

  mapping(uint64 => DonutBet) public bets;
  mapping(address => address) public referrers;

  uint64 public numBets = 0;

  event BetPlaced(uint64 id, uint8 bet, address creator, uint256 value);
  event BetClaimed(uint64 id, address referrer);

  function hasWon(uint64 id) public view returns (bool) {
    if (bets[id].value == 0) return false;

    bytes32 hash = getBlockHash(bets[id].block);

    if (hash == bytes32(0)) return false;

    return uint8(hash[31]) % 16 == bets[id].bet;
  }

  function placeBet(uint8 bet, address referrer) external payable nonReentrant notContract {
    require(msg.value >= minBet, "Donut: Bet amount is less than minimum");
    require(msg.value <= maxBet, "Donut: Bet amount is more than maximum");

    uint64 id = numBets;

    bets[id].bet = bet;
    bets[id].creator = msg.sender;
    bets[id].value = msg.value;
    bets[id].block = block.number;

    referrers[msg.sender] = referrer;

    emit BetPlaced(id, bet, msg.sender, msg.value);

    numBets += 1;
  }

  function claim(uint64 id) external nonReentrant notContract {
    require(bets[id].creator == msg.sender, "Donut: Nothing to claim");
    require(hasWon(id), "Donut: You didn't win");

    send(payable(msg.sender), bets[id].value * multiplier);

    emit BetClaimed(id, referrers[msg.sender]);

    delete bets[id];
  }

  function setFees(uint16 _commissionRate, uint16 _referralRate) external onlyOwner {
    require(
      _commissionRate <= MAX_COMMISSION_RATE && _referralRate <= _commissionRate,
      "Salad: Value exceeds max amount"
    );

    commissionRate = _commissionRate;
    referralRate = _referralRate;
  }

  function setMinBet(uint256 val) external onlyOwner {
    minBet = val;
  }

  function setMaxBet(uint256 val) external onlyOwner {
    maxBet = val;
  }

  function setMultiplier(uint8 val) external onlyOwner {
    require(val <= MAX_MULTIPLIER, "Donut: Value exceeds max amount");
    require(val >= MIN_MULTIPLIER, "Donut: Value is below min amount");

    multiplier = val;
  }

  function deposit() external payable {}

  function withdraw(uint256 amount) external onlyOwner {
    Address.sendValue(payable(owner()), amount);
  }

  function getBlockHash(uint256 blockNumber) internal view virtual returns (bytes32) {
    return blockhash(blockNumber);
  }

  function send(address to, uint256 amount) internal {
    address referrer = referrers[to];
    uint256 fee = (amount * commissionRate) / 10000;

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
