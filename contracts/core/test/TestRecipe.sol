// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Recipe.sol";

contract TestRecipe is Recipe {
  using RedBlackTree for Tree;
  using EnumerableMap for AddressMap;

  // solhint-disable no-empty-blocks
  constructor(address _whirlpool) Recipe(_whirlpool) {}

  function enumerateSortedBids(uint256 id) public view returns (uint256[] memory arr) {
    Tree storage tree = rounds[id].sortedBids;

    uint256 i = 0;
    for (uint256 k = tree.first(); k != 0; k = tree.next(k)) {
      arr[i] = k;
    }
  }

  function enumerateBidders(uint256 id) public view returns (address[] memory keys, uint256[] memory values) {
    AddressMap storage map = rounds[id].bidders;

    for (uint256 i = 0; i < map.size(); i++) {
      keys[i] = map.at(i);
      values[i] = map.get(keys[i]);
    }
  }
}
