// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ds/RedBlackTree.sol";
import "./ds/FastArray.sol";
import "./security/SafeEntry.sol";
import "./utils/TransferWithCommission.sol";
import "./WhirlpoolConsumer.sol";

struct Round {
  Tree sortedBids;
  mapping(uint256 => AddressList) bidToBidders;
  mapping(address => uint256) biddersToBids;
  AddressList bidders;
  uint256 pendingReward;
  address winner;
  uint256 total;
  bool hasEnded;
}

contract Recipe is TransferWithCommission, WhirlpoolConsumer, SafeEntry {
  using RedBlackTree for Tree;
  using FastArray for AddressList;

  Round[] internal rounds;
  uint256 public currentRound;

  // solhint-disable no-empty-blocks
  constructor(address _whirlpool) WhirlpoolConsumer(_whirlpool) {}

  function createBid(uint256 id, address referrer) external payable notContract nonReentrant {
    require(currentRound == id, "Can only bet in current round");
    require(rounds[id].winner == address(0), "Round has ended");
    require(msg.value > 0, "Value can't be 0");

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
      require(round.pendingReward != 0, "Nothing to claim");

      send(round.winner, round.pendingReward);
      round.pendingReward = 0;
      return;
    }

    uint256 myBid = round.biddersToBids[msg.sender];
    require(myBid != 0, "Nothing to claim");

    uint256 myReward = (round.pendingReward * round.total) / myBid;
    round.pendingReward -= myReward;

    removeBid(id, round.bidders.indexes[msg.sender]);

    send(msg.sender, myBid + myReward);
  }

  function next() external {
    _requestRandomness(currentRound);
  }

  function highestBid(uint256 id) public view returns (address bidder, uint256 bid) {
    bid = rounds[id].sortedBids.last();
    bidder = rounds[id].bidToBidders[bid].last();
  }

  function lastBid(uint256 id) public view returns (address bidder, uint256 bid) {
    bidder = rounds[id].bidders.last();
    bid = rounds[id].biddersToBids[bidder];
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
    (address lastBidder, ) = lastBid(id);
    if (highestBidder == bidder && _highestBid == bid) {
      round.pendingReward = round.total;
      round.winner = highestBidderWins ? highestBidder : lastBidder;
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
    round.bidders.remove(index);
    delete round.biddersToBids[bidder];
  }

  function _consumeRandomness(uint256 id, uint256 randomness) internal override {
    eliminate(id, (randomness % rounds[id].bidders.size()), randomness % 2 == 0);
  }
}
