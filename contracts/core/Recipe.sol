// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ds/RedBlackTree.sol";
import "../ds/EnumerableMap.sol";
import "../utils/TransferWithCommission.sol";
import "../utils/ValueLimits.sol";
import "../utils/WhirlpoolConsumer.sol";

struct Round {
  Tree sortedBids;
  mapping(uint256 => uint256) numBidders;
  AddressMap bidders;
  uint256 pendingReward;
  address winner;
  uint256 total;
  uint256 lastPick;
}

struct RoundInfo {
  uint256 numBidders;
  uint256 highestBid;
  uint256 pendingReward;
  address winner;
  uint256 total;
  uint256 lastPick;
}

contract Recipe is TransferWithCommission, ValueLimits, WhirlpoolConsumer {
  using RedBlackTree for Tree;
  using EnumerableMap for AddressMap;

  mapping(uint256 => Round) internal rounds;
  uint256 public currentRound;

  uint16 public constant MAX_HIGHEST_BIDDER_WIN_ODDS = 10000;
  uint16 public highestBidderWinOdds = 2500;

  uint256 public minBidsPerRound = 5;
  uint256 public minAmountPerRound = 1 ether;

  uint256 public constant MAX_COOLDOWN = 4 hours;
  uint256 public cooldown = 10 minutes;

  event BidCreated(uint256 id, address bidder, uint256 value);
  event Claimed(uint256 id, address bidder, uint256 reward);
  event BidderEliminated(uint256 id, address bidder);
  event RoundEnded(uint256 id, address winner);

  // solhint-disable no-empty-blocks
  constructor(address _whirlpool) WhirlpoolConsumer(_whirlpool) ValueLimits(0.001 ether, 100 ether) {}

  function createBid(uint256 id, address referrer) external payable isMinValue {
    require(currentRound == id, "Recipe: Not current round");

    Round storage round = rounds[id];
    uint256 bid = round.bidders.get(msg.sender);

    if (bid > 0) {
      if (--round.numBidders[bid] == 0) round.sortedBids.remove(bid);
    }

    bid += msg.value;

    round.sortedBids.insert(bid);
    round.numBidders[bid]++;
    round.bidders.set(msg.sender, bid);

    round.total += msg.value;

    referrers[msg.sender] = referrer;

    emit BidCreated(id, msg.sender, msg.value);
  }

  function claim(uint256 id) external {
    Round storage round = rounds[id];

    (uint256 bid, uint256 pendingReward) = bidderInfo(id, msg.sender);
    require(bid != 0, "Recipe: Nothing to claim");

    round.pendingReward -= pendingReward;
    round.total -= bid + pendingReward;

    if (round.winner == address(0)) {
      if (--round.numBidders[bid] == 0) round.sortedBids.remove(bid);
      round.bidders.remove(msg.sender);
    }

    emit Claimed(id, msg.sender, bid + pendingReward);

    send(msg.sender, bid + pendingReward);
  }

  function eliminate() external {
    Round storage round = rounds[currentRound];

    // solhint-disable not-rely-on-time
    uint256 timestamp = block.timestamp;

    require(round.total >= minAmountPerRound, "Recipe: Min amount not reached");
    require(round.bidders.size() >= minBidsPerRound, "Recipe: Min bids not reached");
    require(round.lastPick + cooldown <= timestamp, "Recipe: Must cooldown first");

    round.lastPick = timestamp;

    _requestRandomness(round.lastPick);
  }

  function setHighestBidderWinOdds(uint16 val) external onlyOwner {
    require(val <= MAX_HIGHEST_BIDDER_WIN_ODDS, "Recipe: Value exceeds max amount");
    highestBidderWinOdds = val;
  }

  function setCooldown(uint256 val) external onlyOwner {
    require(val <= MAX_COOLDOWN, "Recipe: Value exceeds max amount");
    cooldown = val;
  }

  function setMinForElimination(uint256 minBids, uint256 minAmount) external onlyOwner {
    minBidsPerRound = minBids;
    minAmountPerRound = minAmount;
  }

  function roundInfo(uint256 id) public view returns (RoundInfo memory) {
    Round storage round = rounds[id];
    return
      RoundInfo({
        total: round.total,
        numBidders: round.bidders.size(),
        highestBid: round.sortedBids.last(),
        pendingReward: round.pendingReward,
        winner: round.winner,
        lastPick: round.lastPick
      });
  }

  function bidderInfo(uint256 id, address addr) public view returns (uint256 bid, uint256 reward) {
    Round storage round = rounds[id];

    bid = round.bidders.get(addr);
    if (addr == round.winner) {
      reward = round.pendingReward;
    } else if (round.winner == address(0)) {
      if (round.pendingReward != round.total)
        reward = (round.pendingReward * bid) / (round.total - round.pendingReward);
    } else {
      bid = 0;
    }
  }

  function _consumeRandomness(uint256, uint256 randomness) internal override {
    _eliminate(
      (randomness % rounds[currentRound].bidders.size()),
      randomness % MAX_HIGHEST_BIDDER_WIN_ODDS <= highestBidderWinOdds
    );
  }

  function _eliminate(uint256 index, bool highestBidderWins) private {
    Round storage round = rounds[currentRound];

    address bidder = round.bidders.at(index);
    uint256 bid = round.bidders.get(bidder);

    if (bid == round.sortedBids.last() && highestBidderWins) {
      round.pendingReward = round.total - bid;
      round.winner = bidder;

      emit RoundEnded(currentRound, bidder);

      currentRound++;
      return;
    }

    round.pendingReward += bid;

    if (--round.numBidders[bid] == 0) round.sortedBids.remove(bid);
    round.bidders.remove(bidder);

    emit BidderEliminated(currentRound, bidder);
  }
}
