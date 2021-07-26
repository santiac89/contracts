// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Ownable.sol";

abstract contract TransferWithCommission is Ownable {
  uint16 public constant MAX_COMMISSION_RATE = 1000;

  uint16 public commissionRate = 500;
  uint16 public referralRate = 100;
  uint16 public cancellationFee = 100;

  mapping(address => address) public referrers;

  function setFees(
    uint16 _commissionRate,
    uint16 _referralRate,
    uint16 _cancellationFee
  ) external onlyOwner {
    require(
      _commissionRate <= MAX_COMMISSION_RATE && _referralRate <= _commissionRate && _cancellationFee <= _commissionRate,
      "Transfer: Value exceeds maximum"
    );

    commissionRate = _commissionRate;
    referralRate = _referralRate;
    cancellationFee = _cancellationFee;
  }

  function refund(address to, uint256 amount) internal {
    uint256 fee = (amount * cancellationFee) / 10000;

    _send(to, amount - fee);
    if (fee != 0) _send(owner(), fee);
  }

  function send(address to, uint256 amount) internal {
    uint256 fee = (amount * commissionRate) / 10000;
    _send(to, amount - fee);

    if (fee == 0) return;

    address referrer = referrers[to];
    if (referrer != address(0)) {
      uint256 refBonus = (amount * referralRate) / 10000;

      _send(referrer, refBonus);
      fee -= refBonus;
    }

    _send(owner(), fee);
  }

  function _send(address to, uint256 value) internal {
    require(address(this).balance >= value, "Transfer: insufficient balance");

    // solhint-disable avoid-low-level-calls
    (bool success, ) = payable(to).call{ value: value }("");
    require(success, "Transfer: Unable to send");
  }
}
