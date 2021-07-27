// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/ValueLimits.sol";
import "../utils/TransferWithCommission.sol";
import "../utils/WhirlpoolConsumer.sol";

enum SaladType {
  Pepper,
  Cucumber,
  Onion,
  Carrot,
  Corn,
  Broccoli
}

enum SaladStatus {
  BowlCreated,
  Prepared,
  Served
}

struct SaladBet {
  SaladType bet;
  SaladType bet2;
  uint256 value;
}

struct SaladBowl {
  mapping(SaladType => uint256) sum;
  uint256 createdOn;
  uint256 expiresOn;
  uint256 maxBet;
  address maxBetter;
  SaladStatus status;
  SaladType result;
}

// solhint-disable not-rely-on-time
contract Salad is TransferWithCommission, ValueLimits, WhirlpoolConsumer {
  mapping(uint256 => SaladBowl) public salads;
  mapping(uint256 => mapping(address => SaladBet)) public saladBets;

  uint256 public constant MAX_EXPIRY = 4 days;
  uint256 public constant MIN_EXPIRY = 1 hours;

  uint256 public expiry = 1 days;

  uint256 public currentSalad = 0;

  event IngredientAdded(uint256 id, address creator, SaladType bet, SaladType bet2, uint256 value);
  event IngredientIncreased(uint256 id, address creator, SaladType bet2, uint256 newValue);
  event Claimed(uint256 id, address creator, uint256 value, address referrer);

  event SaladBowlCreated(uint256 id, uint256 expiresOn);
  event SaladPrepared(uint256 id);
  event SaladServed(uint256 id, SaladType result);

  // solhint-disable no-empty-blocks
  constructor(address _whirlpool) WhirlpoolConsumer(_whirlpool) ValueLimits(0.01 ether, 100 ether) {}

  function addIngredient(
    uint256 id,
    SaladType bet,
    SaladType bet2,
    address referrer
  ) external payable isMinValue {
    require(currentSalad == id, "Salad: Not current salad");
    require(salads[id].status == SaladStatus.BowlCreated, "Salad: Already prepared");
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

  function increaseIngredient(uint256 id, SaladType bet2) external payable {
    require(msg.value > 0, "Salad: Value must be more than 0");
    require(saladBets[id][msg.sender].value > 0, "Salad: No bet placed yet");
    require(salads[id].status == SaladStatus.BowlCreated, "Salad: Already prepared");
    require(salads[id].expiresOn > block.timestamp, "Salad: Time is up!");

    salads[id].sum[saladBets[id][msg.sender].bet] += msg.value;
    saladBets[id][msg.sender].bet2 = bet2;
    saladBets[id][msg.sender].value += msg.value;

    setMaxBetForSalad(id, saladBets[id][msg.sender].value);

    emit IngredientIncreased(id, msg.sender, bet2, saladBets[id][msg.sender].value);
  }

  function prepareSalad(uint256 id) external {
    require(salads[id].expiresOn < block.timestamp, "Salad: Time is not up yet!");
    require(salads[id].status == SaladStatus.BowlCreated, "Salad: Already prepared");

    salads[id].status = SaladStatus.Prepared;

    _requestRandomness(id);

    emit SaladPrepared(id);
  }

  function claim(uint256 id) external {
    require(salads[id].status == SaladStatus.Served, "Salad: Not ready to serve yet");
    require(saladBets[id][msg.sender].value > 0, "Salad: Nothing to claim");
    require(saladBets[id][msg.sender].bet != salads[id].result, "Salad: You didn't win!");

    mapping(SaladType => uint256) storage s = salads[id].sum;
    SaladType myBet = saladBets[id][msg.sender].bet;
    uint256 myValue = saladBets[id][msg.sender].value;

    bool jackpot = salads[id].result != saladBets[id][salads[id].maxBetter].bet &&
      salads[id].result == saladBets[id][salads[id].maxBetter].bet2;

    uint256 myReward;

    if (jackpot && salads[id].maxBetter == msg.sender) {
      myReward =
        s[SaladType.Pepper] +
        s[SaladType.Cucumber] +
        s[SaladType.Onion] +
        s[SaladType.Carrot] +
        s[SaladType.Corn] +
        s[SaladType.Broccoli];
    } else if (!jackpot) {
      myReward = ((5 * s[myBet] + s[salads[id].result]) * myValue) / (5 * s[myBet]);
    }

    require(myReward > 0, "Salad: You didn't win!");

    delete saladBets[id][msg.sender];
    emit Claimed(id, msg.sender, myReward, referrers[msg.sender]);

    send(msg.sender, myReward);
  }

  function betSum(uint256 id, SaladType bet) external view returns (uint256) {
    return salads[id].sum[bet];
  }

  function sum(uint256 id) external view returns (uint256) {
    mapping(SaladType => uint256) storage s = salads[id].sum;
    return
      s[SaladType.Pepper] +
      s[SaladType.Cucumber] +
      s[SaladType.Onion] +
      s[SaladType.Carrot] +
      s[SaladType.Corn] +
      s[SaladType.Broccoli];
  }

  function setExpiry(uint256 val) external onlyOwner {
    require(MIN_EXPIRY <= val && val <= MAX_EXPIRY, "Salad: Value is out of bounds");

    expiry = val;
  }

  function _consumeRandomness(uint256 id, uint256 randomness) internal override {
    serveSalad(id, SaladType(randomness % 6));
  }

  function setMaxBetForSalad(uint256 id, uint256 amount) private {
    if (amount > salads[id].maxBet) salads[id].maxBet = amount;
    if (salads[id].maxBet == amount) salads[id].maxBetter = msg.sender;
  }

  function serveSalad(uint256 id, SaladType result) private {
    salads[id].result = result;
    salads[id].status = SaladStatus.Served;

    emit SaladServed(id, result);

    createNewSalad(true);
  }

  function createNewSalad(bool increment) private {
    if (increment) currentSalad += 1;

    salads[currentSalad].createdOn = block.timestamp;
    salads[currentSalad].expiresOn = block.timestamp + expiry;

    emit SaladBowlCreated(currentSalad, block.timestamp + expiry);
  }
}
