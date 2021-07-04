// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IWhirlpoolConsumer.sol";
import "./interfaces/IWhirlpool.sol";

abstract contract WhirlpoolConsumer is Ownable, IWhirlpoolConsumer {
  IWhirlpool whirlpool;
  mapping(bytes32 => uint256) internal activeRequests;

  constructor(IWhirlpool _whirlpool) {
    whirlpool = _whirlpool;
    whirlpool.addConsumer(address(this));
  }

  function _requestRandomness(uint256 id) internal {
    bytes32 requestId = whirlpool.request();
    activeRequests[requestId] = id;
  }

  function consumeRandomness(bytes32 requestId, uint256 _randomness) external override onlyWhirlpoolOrOwner {
    _consumeRandomness(requestId, _randomness);
    delete activeRequests[requestId];
  }

  function _consumeRandomness(bytes32 requestId, uint256 randomness) internal virtual;

  modifier onlyWhirlpoolOrOwner() {
    require(
      msg.sender == address(whirlpool) || msg.sender == owner(),
      "WhirlpoolConsumer: Only whirlpool or owner can call this function"
    );
    _;
  }
}
