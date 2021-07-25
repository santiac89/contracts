// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

struct AddressMapValue {
  uint256 value;
  uint256 index;
}

struct AddressMap {
  mapping(uint256 => address) addresses;
  mapping(address => AddressMapValue) values;
  uint256 startIndex;
  uint256 totalCount;
}

library EnumerableMap {
  function set(
    AddressMap storage self,
    address item,
    uint256 value
  ) internal {
    self.values[item].value = value;

    if (has(self, item)) return;

    self.addresses[self.totalCount] = item;
    self.values[item].index = self.totalCount;
    self.totalCount++;
  }

  function remove(AddressMap storage self, address item) internal {
    if (!has(self, item)) return;

    removeAt(self, self.values[item].index - self.startIndex);
  }

  function removeAt(AddressMap storage self, uint256 index) internal {
    if (index >= size(self)) return;

    uint256 start = self.startIndex;
    address firstItem = self.addresses[start];

    index += start;

    delete self.values[self.addresses[index]];
    self.addresses[index] = firstItem;
    self.values[firstItem].index = index;
    delete self.addresses[start];

    self.startIndex++;
  }

  function size(AddressMap storage self) internal view returns (uint256) {
    return self.totalCount - self.startIndex;
  }

  function has(AddressMap storage self, address item) internal view returns (bool) {
    return self.addresses[self.values[item].index] == item;
  }

  function at(AddressMap storage self, uint256 index) internal view returns (address) {
    return self.addresses[self.startIndex + index];
  }

  function get(AddressMap storage self, address item) internal view returns (uint256) {
    return self.values[item].value;
  }
}
