// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IWhirlpoolConsumer.sol";
import "./interfaces/IWhirlpool.sol";

abstract contract WhirlpoolConsumer is Ownable, IWhirlpoolConsumer {
  IWhirlpool whirlpool;
  mapping(bytes32 => uint64) internal activeRequests;

  bool public whirlpoolEnabled = false;

  constructor(address _whirlpool) {
    whirlpool = IWhirlpool(_whirlpool);
  }

  function _requestRandomness(uint64 id) internal {
    if (whirlpoolEnabled) {
      bytes32 requestId = whirlpool.request();
      activeRequests[requestId] = id;
    } else {
      _consumeRandomness(
        id,
        uint256(
          keccak256(abi.encodePacked(block.difficulty, block.timestamp, block.gaslimit, block.coinbase, block.number))
        )
      );
    }
  }

  function consumeRandomness(bytes32 requestId, uint256 randomness) external override onlyWhirlpoolOrOwner {
    _consumeRandomness(activeRequests[requestId], randomness);
    delete activeRequests[requestId];
  }

  function enableWhirlpool() external onlyOwner {
    whirlpool.addConsumer(address(this));
    whirlpoolEnabled = true;
  }

  function disableWhirlpool() external onlyOwner {
    whirlpoolEnabled = false;
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
