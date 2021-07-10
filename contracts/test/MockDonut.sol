// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Donut.sol";

contract MockDonut is Donut {
  bytes32 internal hash;

  function getBlockHash(uint256) internal view override returns (bytes32) {
    return hash;
  }

  function setBlockHash(bytes32 _hash) external onlyOwner {
    hash = _hash;
  }
}
