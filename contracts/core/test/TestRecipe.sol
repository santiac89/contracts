// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Recipe.sol";

contract TestRecipe is Recipe {
  using RedBlackTree for Tree;
  using EnumerableMap for AddressMap;

  // solhint-disable no-empty-blocks
  constructor(address _whirlpool) Recipe(_whirlpool) {}

  function enumerateSortedBids(uint256 id, uint256 size) public view returns (uint256[] memory) {
    uint256[] memory arr = new uint256[](size);
    Tree storage tree = rounds[id].sortedBids;

    uint256 i = 0;
    for (uint256 k = tree.first(); k != 0; k = tree.next(k)) {
      arr[i++] = k;
    }

    return arr;
  }

  function enumerateBids(uint256 id, uint256 size) public view returns (uint256[] memory) {
    uint256[] memory values = new uint256[](size);
    AddressMap storage map = rounds[id].bidders;

    for (uint256 i = 0; i < size; i++) {
      values[i] = map.get(map.at(i));
    }

    return values;
  }

  function hasBidder(uint256 id, address bidder) public view returns (bool) {
    return rounds[id].bidders.has(bidder);
  }
}
