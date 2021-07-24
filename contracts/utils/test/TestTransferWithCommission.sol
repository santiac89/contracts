// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../TransferWithCommission.sol";

contract TestTransferWithCommission is TransferWithCommission {
  function setReferrer(address origin, address referrer) external onlyOwner {
    referrers[origin] = referrer;
  }

  function testRefund(address to, uint256 amount) external onlyOwner {
    refund(to, amount);
  }

  function testSend(address to, uint256 amount) external onlyOwner {
    send(to, amount);
  }

  // solhint-disable no-empty-blocks
  function deposit() external payable onlyOwner {}
}
