// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../EnumerableMap.sol";

contract TestEnumerableMap {
  using EnumerableMap for AddressMap;

  AddressMap public map;

  function set(address item, uint256 value) external {
    map.set(item, value);
  }

  function remove(address item) external {
    map.remove(item);
  }

  function removeAt(uint256 index) external {
    map.removeAt(index);
  }

  function size() external view returns (uint256) {
    return map.size();
  }

  function has(address item) external view returns (bool) {
    return map.has(item);
  }

  function at(uint256 index) external view returns (address) {
    return map.at(index);
  }

  function get(address item) external view returns (uint256) {
    return map.get(item);
  }
}
