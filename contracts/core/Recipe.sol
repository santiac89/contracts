// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ds/RedBlackTree.sol";
import "../ds/EnumerableMap.sol";
import "../security/SafeEntry.sol";
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
  bool hasEnded;
}

contract Recipe is TransferWithCommission, ValueLimits, WhirlpoolConsumer, SafeEntry {
  using RedBlackTree for Tree;
  using EnumerableMap for AddressMap;

  mapping(uint256 => Round) internal rounds;
  uint256 public currentRound;

  uint16 public constant MAX_HIGHEST_BIDDER_WIN_ODDS = 10000;
  uint16 public highestBidderWinOdds = 2500;

  uint256 public minBidsPerRound = 5;
  uint256 public minAmountPerRound = 1 ether;

  // solhint-disable no-empty-blocks
  constructor(address _whirlpool) WhirlpoolConsumer(_whirlpool) ValueLimits(0.001 ether, 100 ether) {}

  function createBid(uint256 id, address referrer) external payable notContract nonReentrant isMinValue {
    require(currentRound == id, "Recipe: Not current round");

    Round storage round = rounds[id];

    require(round.winner == address(0), "Recipe: Round has ended");

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
  }

  function claim(uint256 id) external notContract nonReentrant {
    Round storage round = rounds[id];

    (uint256 bid, uint256 reward) = userInfo(id, msg.sender);
    require(reward != 0, "Recipe: Nothing to claim");

    round.pendingReward -= reward;
    round.total -= bid + reward;

    if (round.winner != address(0)) {
      removeBid(id, round.bidders.values[msg.sender].index);
    }

    send(msg.sender, bid + reward);
  }

  function pickOrEliminate() external notContract nonReentrant {
    Round storage round = rounds[currentRound];

    require(round.total >= minAmountPerRound, "Recipe: Min amount not reached");
    require(round.bidders.size() >= minBidsPerRound, "Recipe: Min bids not reached");

    _requestRandomness(currentRound);
  }

  function setHighestBidderWinOdds(uint16 val) external onlyOwner {
    require(val <= MAX_HIGHEST_BIDDER_WIN_ODDS, "Recipe: Value exceeds max amount");
    highestBidderWinOdds = val;
  }

  function setMinForElimination(uint256 minBids, uint256 minAmount) external onlyOwner {
    minBidsPerRound = minBids;
    minAmountPerRound = minAmount;
  }

  function highestBid(uint256 id) public view returns (uint256 bid) {
    bid = rounds[id].sortedBids.last();
  }

  function roundInfo(uint256 id)
    public
    view
    returns (
      uint256 _pendingReward,
      address _winner,
      uint256 _total,
      bool _hasEnded
    )
  {
    Round storage round = rounds[id];
    return (round.pendingReward, round.winner, round.total, round.hasEnded);
  }

  function userInfo(uint256 id, address addr) public view returns (uint256 myBid, uint256 myReward) {
    Round storage round = rounds[id];

    myBid = round.bidders.get(addr);
    if (msg.sender == round.winner) {
      myReward = round.pendingReward;
    } else {
      myReward = myBid == 0 ? 0 : (round.pendingReward * round.total) / myBid;
    }
  }

  function numBids(uint256 id) public view returns (uint256) {
    return rounds[id].bidders.size();
  }

  function eliminate(
    uint256 id,
    uint256 index,
    bool highestBidderWins
  ) internal {
    Round storage round = rounds[id];

    address bidder = round.bidders.at(index);
    uint256 bid = round.bidders.get(bidder);

    if (bid == highestBid(id) && highestBidderWins) {
      round.pendingReward = round.total;
      round.winner = bidder;
      currentRound++;
      return;
    }

    round.pendingReward += bid;

    removeBid(id, index);
  }

  function removeBid(uint256 id, uint256 index) internal {
    Round storage round = rounds[id];

    address bidder = round.bidders.at(index);
    uint256 bid = round.bidders.get(bidder);

    if (--round.numBiddersAtBid[bid] == 0) round.sortedBids.remove(bid);
    round.bidders.removeAt(index);
  }

  function _consumeRandomness(uint256 id, uint256 randomness) internal override {
    eliminate(
      id,
      (randomness % rounds[id].bidders.size()),
      randomness % MAX_HIGHEST_BIDDER_WIN_ODDS <= highestBidderWinOdds
    );
  }
}
