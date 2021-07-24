// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ds/RedBlackTree.sol";
import "../ds/EnumerableSet.sol";
import "../security/SafeEntry.sol";
import "../utils/TransferWithCommission.sol";
import "../utils/ValueLimits.sol";
import "../utils/WhirlpoolConsumer.sol";

struct Round {
  Tree sortedBids;
  mapping(uint256 => AddressSet) bidToBidders;
  mapping(address => uint256) biddersToBids;
  AddressSet bidders;
  uint256 pendingReward;
  address winner;
  uint256 total;
  bool hasEnded;
}

contract Recipe is TransferWithCommission, ValueLimits, WhirlpoolConsumer, SafeEntry {
  using RedBlackTree for Tree;
  using EnumerableSet for AddressSet;

  Round[] internal rounds;
  uint256 public currentRound;

  uint16 public constant MAX_HIGHEST_BIDDER_WIN_ODDS = 10000;
  uint16 public highestBidderWinOdds = 2500;

  uint256 public minBidsPerRound = 5;
  uint256 public minAmountPerRound = 1 ether;

  // solhint-disable no-empty-blocks
  constructor(address _whirlpool) WhirlpoolConsumer(_whirlpool) ValueLimits(0.001 ether, 100 ether) {}

  function createBid(uint256 id, address referrer) external payable notContract nonReentrant isMinValue {
    require(currentRound == id, "Recipe: Not current round");
    require(rounds[id].winner == address(0), "Recipe: Round has ended");

    Round storage round = rounds[id];

    uint256 myBid = round.biddersToBids[msg.sender];

    round.bidToBidders[myBid].remove(msg.sender);
    if (round.bidToBidders[myBid].size() == 0) round.sortedBids.remove(myBid);

    if (myBid == 0) round.bidders.add(msg.sender);

    myBid += msg.value;

    round.sortedBids.insert(myBid);
    round.bidToBidders[myBid].add(msg.sender);
    round.biddersToBids[msg.sender] = myBid;

    round.total += msg.value;

    referrers[msg.sender] = referrer;
  }

  function claim(uint256 id) external notContract nonReentrant {
    Round storage round = rounds[id];

    if (msg.sender == round.winner) {
      require(round.pendingReward != 0, "Recipe: Nothing to claim");

      send(round.winner, round.pendingReward);
      round.pendingReward = 0;
      return;
    }

    uint256 myBid = round.biddersToBids[msg.sender];
    require(myBid != 0, "Recipe: Nothing to claim");

    uint256 myReward = (round.pendingReward * round.total) / myBid;
    round.pendingReward -= myReward;

    removeBid(id, round.bidders.indexes[msg.sender]);

    send(msg.sender, myBid + myReward);
  }

  function pickOrEliminate() external {
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

  function highestBid(uint256 id) public view returns (address bidder, uint256 bid) {
    bid = rounds[id].sortedBids.last();
    bidder = rounds[id].bidToBidders[bid].get(0);
  }

  function eliminate(
    uint256 id,
    uint256 index,
    bool highestBidderWins
  ) internal {
    Round storage round = rounds[id];

    address bidder = round.bidders.get(index);
    uint256 bid = round.biddersToBids[bidder];

    (address highestBidder, uint256 _highestBid) = highestBid(id);
    if (highestBidder == bidder && _highestBid == bid && highestBidderWins) {
      round.pendingReward = round.total;
      round.winner = highestBidder;
      currentRound++;
      return;
    }

    round.pendingReward += bid;

    removeBid(id, index);
  }

  function removeBid(uint256 id, uint256 index) internal {
    Round storage round = rounds[id];
    address bidder = round.bidders.get(index);
    uint256 bid = round.biddersToBids[bidder];

    round.bidToBidders[bid].remove(bidder);
    if (round.bidToBidders[bid].size() == 0) round.sortedBids.remove(bid);
    round.bidders.removeAt(index);
    delete round.biddersToBids[bidder];
  }

  function _consumeRandomness(uint256 id, uint256 randomness) internal override {
    eliminate(
      id,
      (randomness % rounds[id].bidders.size()),
      randomness % MAX_HIGHEST_BIDDER_WIN_ODDS <= highestBidderWinOdds
    );
  }
}
