// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWhirlpoolConsumer {
  function consumeRandomness(bytes32 requestId, uint256 randomness) external;
}
