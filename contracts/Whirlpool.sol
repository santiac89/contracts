// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/dev/VRFConsumerBase.sol";
import "./interfaces/IWhirlpoolConsumer.sol";
import "./interfaces/IWhirlpool.sol";

contract Whirlpool is VRFConsumerBase, Ownable, IWhirlpool {
  mapping(address => bool) private validConsumers;
  mapping(bytes32 => address) private activeRequests;

  bytes32 internal keyHash;
  uint256 internal fee;

  event RequestedRandomness(bytes32 requestId, address consumer);
  event FulfilledRandomness(bytes32 requestId, uint256 randomness);

  constructor(
    address _vrfCoordinator,
    address _link,
    bytes32 _keyHash,
    uint256 _fee
  ) VRFConsumerBase(_vrfCoordinator, _link) {
    keyHash = _keyHash;
    fee = _fee;
  }

  function request() external override validConsumer hasEnoughLINK returns (bytes32 requestId) {
    requestId = requestRandomness(keyHash, fee);
    activeRequests[requestId] = msg.sender;
    emit RequestedRandomness(requestId, msg.sender);
  }

  function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
    IWhirlpoolConsumer(activeRequests[requestId]).consumeRandomness(requestId, randomness);
    delete activeRequests[requestId];
    emit FulfilledRandomness(requestId, randomness);
  }

  function setKeyHash(bytes32 _keyHash) external override onlyOwner {
    keyHash = _keyHash;
  }

  function setFee(uint256 _fee) external override onlyOwner {
    fee = _fee;
  }

  function addConsumer(address consumerAddress) external override onlyOwner {
    validConsumers[consumerAddress] = true;
  }

  function deleteConsumer(address consumerAddress) external override onlyOwner {
    delete validConsumers[consumerAddress];
  }

  function withdrawLink() external override onlyOwner {
    require(LINK.transfer(msg.sender, LINK.balanceOf(address(this))), "Whirlpool: Unable to transfer");
  }

  modifier hasEnoughLINK {
    require(LINK.balanceOf(address(this)) >= fee, "Whirlpool: Not enough LINK");
    _;
  }

  modifier validConsumer {
    require(validConsumers[msg.sender], "Whirlpool: Not a valid consumer");
    _;
  }
}
