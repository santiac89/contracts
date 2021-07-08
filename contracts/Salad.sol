// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "./WhirlpoolConsumer.sol";
import "./security/SafeEntry.sol";

contract Salad is WhirlpoolConsumer, SafeEntry {
  using Address for address;
  using Math for uint256;

  enum SaladStatus {
    Available,
    Prepared,
    Claimable
  }

  struct SaladBet {
    uint8 bet;
    uint8 bet2;
    uint256 value;
  }

  struct SaladBowl {
    uint256[6] sum;
    uint256 maxBet;
    address maxBetter;
    uint256 createdOn;
    uint256 expiry;
    SaladStatus status;
    uint8 result;
  }

  mapping(uint64 => SaladBowl) public salads;
  mapping(uint64 => mapping(address => SaladBet)) public saladBets;
  mapping(address => address) public referrers;

  uint16 public constant MAX_COMMISSION_RATE = 1000;

  uint16 public commissionRate = 500;
  uint16 public referralRate = 100;

  uint64 public numBets = 0;

  uint256 public minBet = 0.01 ether;
  uint256 public expiry = 1 days;

  uint64 public currentSalad = 0;

  constructor(address _whirlpool) WhirlpoolConsumer(_whirlpool) {}

  function createBet(
    uint64 id,
    uint8 bet,
    uint8 bet2,
    address referrer
  ) external payable nonReentrant notContract {
    require(id == currentSalad, "Salad: Can only bet in current salad");
    require(bet >= 0 && bet <= 5 && bet2 >= 0 && bet2 <= 5, "Salad: Can only bet 0-5");
    require(saladBets[id][msg.sender].value == 0, "Salad: Already placed bet");
    require(
      salads[id].createdOn == 0 || salads[currentSalad].createdOn + expiry > block.timestamp,
      "Salad: Time is up!"
    );
    require(salads[id].status == SaladStatus.Available, "Salad: Not open!");

    salads[id].sum[bet] += msg.value;
    saladBets[id][msg.sender].bet = bet;
    saladBets[id][msg.sender].bet2 = bet2;
    saladBets[id][msg.sender].value = msg.value;

    referrers[msg.sender] = referrer;

    setMaxBet(id, msg.value);
  }

  function increaseBet(uint64 id) external payable nonReentrant notContract {
    require(saladBets[id][msg.sender].value > 0, "Salad: No bet placed yet");
    require(salads[id].status == SaladStatus.Available, "Salad: Not open!");
    require(salads[id].createdOn + expiry > block.timestamp, "Salad: Time is up!");

    salads[id].sum[saladBets[id][msg.sender].bet] += msg.value;
    saladBets[id][msg.sender].value += msg.value;

    setMaxBet(id, saladBets[id][msg.sender].value);
  }

  function setMaxBet(uint64 id, uint256 amount) internal {
    salads[id].maxBet = Math.max(salads[id].maxBet, amount);
    if (salads[id].maxBet == amount) salads[id].maxBetter = msg.sender;
  }

  function checkClaim(uint64 id) external nonReentrant notContract {
    require(salads[id].createdOn + expiry < block.timestamp, "Salad: Time is not up yet!");
    require(salads[id].status == SaladStatus.Available, "Salad: Already claimable");

    salads[id].status = SaladStatus.Prepared;

    _requestRandomness(id);
  }

  function prepareSalad(uint64 id, uint8 result) internal {
    salads[id].result = result;
    salads[id].status = SaladStatus.Claimable;

    currentSalad += 1;
  }

  function _consumeRandomness(uint64 id, uint256 randomness) internal override {
    prepareSalad(id, uint8(randomness % 6));
  }

  function claim(uint64 id) external nonReentrant notContract {
    require(salads[id].status == SaladStatus.Claimable, "Salad: Not yet claimable");
    require(saladBets[id][msg.sender].value > 0, "Salad: Nothing to claim");
    require(saladBets[id][msg.sender].bet != salads[id].result, "Salad: You didn't win!");

    uint256[6] memory sum = salads[id].sum;
    uint8 myBet = saladBets[id][msg.sender].bet;
    uint256 myValue = saladBets[id][msg.sender].value;

    bool jackpot = salads[id].result != saladBets[id][salads[id].maxBetter].bet &&
      salads[id].result == saladBets[id][salads[id].maxBetter].bet2;

    uint256 myReward;

    if (jackpot && salads[id].maxBetter == msg.sender) {
      myReward = sum[0] + sum[1] + sum[2] + sum[3] + sum[4] + sum[5];
    } else if (!jackpot) {
      myReward = ((5 * sum[myBet] + sum[salads[id].result]) * myValue) / (5 * sum[myBet]);
    }

    require(myReward > 0, "Salad: Nothing to claim");

    send(msg.sender, myReward);
  }

  function betSum(uint64 id, uint8 bet) external view returns (uint256) {
    return salads[id].sum[bet];
  }

  function betSum(uint64 id) external view returns (uint256) {
    uint256[6] storage sum = salads[id].sum;
    return sum[0] + sum[1] + sum[2] + sum[3] + sum[4] + sum[5];
  }

  function setCommissionRate(uint16 val) external onlyOwner {
    require(val <= MAX_COMMISSION_RATE, "Salad: Value exceeds max amount");
    commissionRate = val;
  }

  function setReferralRate(uint16 val) external onlyOwner {
    require(val <= commissionRate, "Salad: Value exceeds max amount");
    referralRate = val;
  }

  function setMinBet(uint256 val) external onlyOwner {
    minBet = val;
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
