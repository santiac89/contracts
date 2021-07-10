// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "./WhirlpoolConsumer.sol";
import "./security/SafeEntry.sol";

contract Salad is WhirlpoolConsumer, SafeEntry {
  using Address for address;
  using Math for uint256;

  enum SaladStatus {
    BowlCreated,
    Prepared,
    Served
  }

  struct SaladBet {
    uint8 bet;
    uint8 bet2;
    uint256 value;
  }

  struct SaladBowl {
    uint256[6] sum;
    uint256 createdOn;
    uint256 expiresOn;
    uint256 maxBet;
    address maxBetter;
    SaladStatus status;
    uint8 result;
  }

  mapping(uint256 => SaladBowl) public salads;
  mapping(uint256 => mapping(address => SaladBet)) public saladBets;
  mapping(address => address) public referrers;

  uint16 public constant MAX_COMMISSION_RATE = 1000;
  uint256 public MAX_EXPIRY = 4 days;
  uint256 public MIN_EXPIRY = 5 minutes;

  uint16 public commissionRate = 500;
  uint16 public referralRate = 100;

  uint256 public minBet = 0.01 ether;
  uint256 public expiry = 1 days;

  uint256 public currentSalad = 0;

  event IngredientAdded(uint256 id, address player, uint8 bet, uint8 bet2, uint256 value);
  event IngredientIncreased(uint256 id, address player, uint256 newValue);
  event Claimed(uint256 id, address player, uint256 value, address referrer);

  event SaladBowlCreated(uint256 id, uint256 expiresOn);
  event SaladPrepared(uint256 id);
  event SaladServed(uint256 id, uint8 result);

  constructor(address _whirlpool) WhirlpoolConsumer(_whirlpool) {}

  function addIngredient(
    uint256 id,
    uint8 bet,
    uint8 bet2,
    address referrer
  ) external payable nonReentrant notContract {
    require(currentSalad == id, "Salad: Can only bet in current salad");
    require(salads[id].status == SaladStatus.BowlCreated, "Salad: Already prepared");
    require(bet >= 0 && bet <= 5 && bet2 >= 0 && bet2 <= 5, "Salad: Can only bet 0-5");
    require(msg.value >= minBet, "Salad: Value must be greater than min bet");
    require(saladBets[id][msg.sender].value == 0, "Salad: Already placed bet");

    if (salads[currentSalad].createdOn == 0) createNewSalad(false);

    require(salads[currentSalad].expiresOn > block.timestamp, "Salad: Time is up!");

    salads[id].sum[bet] += msg.value;
    saladBets[id][msg.sender].bet = bet;
    saladBets[id][msg.sender].bet2 = bet2;
    saladBets[id][msg.sender].value = msg.value;

    referrers[msg.sender] = referrer;

    setMaxBetForSalad(id, msg.value);

    emit IngredientAdded(id, msg.sender, bet, bet2, msg.value);
  }

  function increaseIngredient(uint256 id) external payable nonReentrant notContract {
    require(msg.value > 0, "Salad: Value must be greater than 0");
    require(saladBets[id][msg.sender].value > 0, "Salad: No bet placed yet");
    require(salads[id].status == SaladStatus.BowlCreated, "Salad: Already prepared");
    require(salads[id].expiresOn > block.timestamp, "Salad: Time is up!");

    salads[id].sum[saladBets[id][msg.sender].bet] += msg.value;
    saladBets[id][msg.sender].value += msg.value;

    setMaxBetForSalad(id, saladBets[id][msg.sender].value);

    emit IngredientIncreased(id, msg.sender, saladBets[id][msg.sender].value);
  }

  function prepareSalad(uint256 id) external nonReentrant notContract {
    require(salads[id].expiresOn < block.timestamp, "Salad: Time is not up yet!");
    require(salads[id].status == SaladStatus.BowlCreated, "Salad: Already prepared");

    salads[id].status = SaladStatus.Prepared;

    _requestRandomness(id);

    emit SaladPrepared(id);
  }

  function claim(uint256 id) external nonReentrant notContract {
    require(salads[id].status == SaladStatus.Served, "Salad: Not ready to serve yet");
    require(saladBets[id][msg.sender].value > 0, "Salad: You didn't place a bet");
    require(saladBets[id][msg.sender].bet != salads[id].result, "Salad: You didn't win!");

    uint256[6] storage s = salads[id].sum;
    uint8 myBet = saladBets[id][msg.sender].bet;
    uint256 myValue = saladBets[id][msg.sender].value;

    bool jackpot = salads[id].result != saladBets[id][salads[id].maxBetter].bet &&
      salads[id].result == saladBets[id][salads[id].maxBetter].bet2;

    uint256 myReward;

    if (jackpot && salads[id].maxBetter == msg.sender) {
      myReward = s[0] + s[1] + s[2] + s[3] + s[4] + s[5];
    } else if (!jackpot) {
      myReward = ((5 * s[myBet] + s[salads[id].result]) * myValue) / (5 * s[myBet]);
    }

    require(myReward > 0, "Salad: You didn't win!");

    delete saladBets[id][msg.sender];

    send(msg.sender, myReward);

    emit Claimed(id, msg.sender, myReward, referrers[msg.sender]);
  }

  function betSum(uint256 id, uint8 bet) external view returns (uint256) {
    return salads[id].sum[bet];
  }

  function sum(uint256 id) external view returns (uint256) {
    uint256[6] storage s = salads[id].sum;
    return s[0] + s[1] + s[2] + s[3] + s[4] + s[5];
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

  function setExpiry(uint256 val) external onlyOwner {
    require(val <= MAX_EXPIRY, "Salad: Value exceeds max amount");
    require(val >= MIN_EXPIRY, "Salad: Value is less than min amount");

    expiry = val;
  }

  function setMaxBetForSalad(uint256 id, uint256 amount) internal {
    salads[id].maxBet = Math.max(salads[id].maxBet, amount);
    if (salads[id].maxBet == amount) salads[id].maxBetter = msg.sender;
  }

  function serveSalad(uint256 id, uint8 result) internal {
    salads[id].result = result;
    salads[id].status = SaladStatus.Served;

    emit SaladServed(id, result);

    createNewSalad(true);
  }

  function createNewSalad(bool increment) internal {
    if (increment) currentSalad += 1;

    salads[currentSalad].createdOn = block.timestamp;
    salads[currentSalad].expiresOn = block.timestamp + expiry;

    emit SaladBowlCreated(currentSalad, block.timestamp + expiry);
  }

  function _consumeRandomness(uint256 id, uint256 randomness) internal override {
    serveSalad(id, uint8(randomness % 6));
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
