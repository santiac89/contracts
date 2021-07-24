// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ds/EnumerableSet.sol";

contract TestEnumerableSet {
  using EnumerableSet for AddressSet;

  AddressSet public list;

  function add(address item) external {
    list.add(item);
  }

  function remove(address item) external {
    list.remove(item);
  }

  function removeAt(uint256 index) external {
    list.removeAt(index);
  }

  function size() external view returns (uint256) {
    return list.size();
  }

  function has(address item) external view returns (bool) {
    return list.has(item);
  }

  function get(uint256 index) external view returns (address) {
    return list.get(index);
  }
}
