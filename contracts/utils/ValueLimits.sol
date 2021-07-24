// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract ValueLimits is Ownable {
  uint256 public minValue;
  uint256 public maxValue;

  constructor(uint256 min, uint256 max) {
    minValue = min;
    maxValue = max;
  }

  modifier isMinValue() {
    require(msg.value >= minValue, "ValueLimits: Less than minimum");
    _;
  }

  modifier isMaxValue() {
    require(msg.value <= maxValue, "ValueLimits: More than maximum");
    _;
  }

  function setMinValue(uint256 val) external onlyOwner {
    minValue = val;
  }

  function setMaxValue(uint256 val) external onlyOwner {
    maxValue = val;
  }
}
