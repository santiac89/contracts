// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

struct AddressList {
  mapping(uint256 => address) addresses;
  mapping(address => uint256) indexes;
  uint256 startIndex;
  uint256 totalCount;
}

library FastArray {
  function add(AddressList storage self, address item) internal {
    self.addresses[self.totalCount++] = item;
    self.indexes[item] = self.totalCount;
  }

  function remove(AddressList storage self, address item) internal {
    remove(self, self.indexes[item]);
  }

  function remove(AddressList storage self, uint256 index) internal {
    delete self.indexes[self.addresses[index]];
    self.addresses[index] = self.addresses[self.startIndex];
    self.indexes[self.addresses[self.startIndex]] = index;
    delete self.addresses[self.startIndex];

    self.startIndex++;
  }

  function size(AddressList storage self) internal view returns (uint256) {
    return self.totalCount - self.startIndex;
  }

  function get(AddressList storage self, uint256 index) internal view returns (address) {
    return self.addresses[self.startIndex + index];
  }

  function first(AddressList storage self) internal view returns (address) {
    return self.addresses[self.startIndex];
  }

  function last(AddressList storage self) internal view returns (address) {
    return self.addresses[self.totalCount - 1];
  }
}
