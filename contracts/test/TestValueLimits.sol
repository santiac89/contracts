// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/ValueLimits.sol";

contract TestValueLimits is ValueLimits {
  // solhint-disable no-empty-blocks
  constructor() ValueLimits(0.01 ether, 1 ether) {}

  // solhint-disable no-empty-blocks
  function deposit() external payable onlyOwner isMinValue isMaxValue {}
}
