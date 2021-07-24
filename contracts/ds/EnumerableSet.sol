// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

struct AddressSet {
  mapping(uint256 => address) addresses;
  mapping(address => uint256) indexes;
  uint256 startIndex;
  uint256 totalCount;
}

library EnumerableSet {
  function add(AddressSet storage self, address item) internal {
    if (has(self, item)) return;

    self.addresses[self.totalCount] = item;
    self.indexes[item] = self.totalCount;
    self.totalCount++;
  }

  function remove(AddressSet storage self, address item) internal {
    if (!has(self, item)) return;

    removeAt(self, self.indexes[item] - self.startIndex);
  }

  function removeAt(AddressSet storage self, uint256 index) internal {
    if (index >= size(self)) return;

    uint256 start = self.startIndex;
    address firstItem = self.addresses[start];

    index += start;

    self.addresses[index] = firstItem;
    self.indexes[firstItem] = index;
    delete self.addresses[start];

    self.startIndex++;
  }

  function size(AddressSet storage self) internal view returns (uint256) {
    return self.totalCount - self.startIndex;
  }

  function has(AddressSet storage self, address item) internal view returns (bool) {
    return self.addresses[self.indexes[item]] == item;
  }

  function get(AddressSet storage self, uint256 index) internal view returns (address) {
    return self.addresses[self.startIndex + index];
  }
}
