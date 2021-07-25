// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IWhirlpool {
  function request() external returns (bytes32);

  function setKeyHash(bytes32 _keyHash) external;

  function setFee(uint256 _fee) external;

  function addConsumer(address consumerAddress) external;

  function deleteConsumer(address consumerAddress) external;

  function withdrawLink() external;
}
