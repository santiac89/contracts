// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Ownable.sol";
import "./interfaces/IWhirlpoolConsumer.sol";
import "./interfaces/IWhirlpool.sol";

abstract contract WhirlpoolConsumer is Ownable, IWhirlpoolConsumer {
  IWhirlpool internal whirlpool;
  mapping(bytes32 => uint256) internal activeRequests;

  bool public whirlpoolEnabled = false;

  constructor(address _whirlpool) {
    whirlpool = IWhirlpool(_whirlpool);
  }

  function _requestRandomness(uint256 id) internal {
    if (whirlpoolEnabled) {
      bytes32 requestId = whirlpool.request();
      activeRequests[requestId] = id;
    } else {
      bytes32 random = keccak256(
        // solhint-disable-next-line not-rely-on-time
        abi.encodePacked(id, block.difficulty, block.timestamp, block.gaslimit, block.coinbase, block.number)
      );
      _consumeRandomness(id, uint256(random));
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

  function _consumeRandomness(uint256 id, uint256 randomness) internal virtual;

  modifier onlyWhirlpoolOrOwner() {
    require(msg.sender == address(whirlpool) || msg.sender == owner(), "WhirlpoolConsumer: Not whirlpool");
    _;
  }
}
