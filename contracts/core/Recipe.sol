// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ds/RedBlackTree.sol";
import "../ds/EnumerableMap.sol";
import "../utils/TransferWithCommission.sol";
import "../utils/ValueLimits.sol";
import "../utils/WhirlpoolConsumer.sol";

struct Round {
  Tree sortedBids;
  mapping(uint256 => uint256) numBiddersAtBid;
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
    uint256 myBid = round.bidders.get(msg.sender);

    if (myBid > 0) {
      if (--round.numBiddersAtBid[myBid] == 0) round.sortedBids.remove(myBid);
    }

    myBid += msg.value;

    round.sortedBids.insert(myBid);
    round.numBiddersAtBid[myBid]++;
    round.bidders.set(msg.sender, myBid);

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
      removeBidder(id, msg.sender);
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

  function bidderInfo(uint256 id, address addr) public view returns (uint256 myBid, uint256 myReward) {
    Round storage round = rounds[id];

    myBid = round.bidders.get(addr);
    if (addr == round.winner) {
      myReward = round.pendingReward;
    } else {
      myReward = myBid == 0 ? 0 : (round.pendingReward * myBid) / round.total;
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
    uint256 highestBid = round.sortedBids.last();

    if (bid == highestBid && highestBidderWins) {
      round.pendingReward = round.total;
      round.winner = bidder;

      emit RoundEnded(currentRound, bidder);

      currentRound++;
      return;
    }

    round.pendingReward += bid;

    removeBidder(currentRound, round.bidders.at(index));

    emit BidderEliminated(currentRound, bidder);
  }

  function removeBidder(uint256 id, address bidder) private {
    Round storage round = rounds[id];

    uint256 bid = round.bidders.get(bidder);

    if (--round.numBiddersAtBid[bid] == 0) round.sortedBids.remove(bid);
    round.bidders.remove(bidder);
  }
}
