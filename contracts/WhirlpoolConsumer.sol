// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IWhirlpoolConsumer.sol";
import "./interfaces/IWhirlpool.sol";

abstract contract WhirlpoolConsumer is Ownable, IWhirlpoolConsumer {
  IWhirlpool whirlpool;
  mapping(bytes32 => uint64) internal activeRequests;

  constructor(address _whirlpool) {
    whirlpool = IWhirlpool(_whirlpool);
  }

  function _requestRandomness(uint64 id) internal {
    bytes32 requestId = whirlpool.request();
    activeRequests[requestId] = id;
  }

  function consumeRandomness(bytes32 requestId, uint256 _randomness) external override onlyWhirlpoolOrOwner {
    _consumeRandomness(activeRequests[requestId], _randomness);
    delete activeRequests[requestId];
  }

  function _consumeRandomness(uint64 id, uint256 randomness) internal virtual;

  modifier onlyWhirlpoolOrOwner() {
    require(
      msg.sender == address(whirlpool) || msg.sender == owner(),
      "WhirlpoolConsumer: Only whirlpool or owner can call this function"
    );
    _;
  }
}
