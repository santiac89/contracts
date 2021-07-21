// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ds/FastArray.sol";

contract TestFastArray {
  using FastArray for AddressList;

  AddressList internal list;

  function add(address item) external {
    list.add(item);
  }

  function remove(address item) external {
    list.remove(item);
  }

  function remove(uint256 index) external {
    list.remove(index);
  }

  function size() external view returns (uint256) {
    return list.size();
  }

  function get(uint256 index) external view returns (address) {
    return list.get(index);
  }

  function first() external view returns (address) {
    return list.first();
  }

  function last() external view returns (address) {
    return list.last();
  }
}
