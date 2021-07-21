// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

abstract contract TransferWithCommission is Ownable {
  using Address for address;

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
      "Value exceeds max amount"
    );

    commissionRate = _commissionRate;
    referralRate = _referralRate;
  }

  function sendWithoutFee(address to, uint256 amount) internal {
    Address.sendValue(payable(to), amount);
  }

  function refund(address to, uint256 amount) internal {
    uint256 fee = (amount * cancellationFee) / 10000;

    Address.sendValue(payable(to), amount - fee);
    if (fee != 0) Address.sendValue(payable(owner()), fee);
  }

  function send(address to, uint256 amount) internal {
    uint256 fee = (amount * commissionRate) / 10000;
    Address.sendValue(payable(to), amount - fee);

    if (fee == 0) return;

    address referrer = referrers[to];
    if (referrer != address(0)) {
      uint256 refBonus = (amount * referralRate) / 10000;

      Address.sendValue(payable(referrer), refBonus);
      fee -= refBonus;
    }

    Address.sendValue(payable(owner()), fee);
  }
}
