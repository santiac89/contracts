// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

  function receiveToken(
    address token,
    address from,
    uint256 amount
  ) internal {
    // already received ether as payable
    if (token == address(0)) return;

    require(IERC20(token).transferFrom(from, address(this), amount), "Transfer: Unable to receive");
  }

  function refundToken(
    address token,
    address to,
    uint256 amount
  ) internal {
    uint256 fee = (amount * cancellationFee) / 10000;

    _send(token, to, amount - fee);
    if (fee != 0) _send(token, owner(), fee);
  }

  function sendToken(
    address token,
    address to,
    uint256 amount
  ) internal {
    uint256 fee = (amount * commissionRate) / 10000;
    _send(token, to, amount - fee);

    if (fee == 0) return;

    address referrer = referrers[to];
    if (referrer != address(0)) {
      uint256 refBonus = (amount * referralRate) / 10000;

      _send(token, referrer, refBonus);
      fee -= refBonus;
    }

    _send(token, owner(), fee);
  }

  function refund(address to, uint256 amount) internal {
    refundToken(address(0), to, amount);
  }

  function send(address to, uint256 amount) internal {
    sendToken(address(0), to, amount);
  }

  function _send(
    address token,
    address to,
    uint256 value
  ) internal {
    if (token == address(0)) {
      require(address(this).balance >= value, "Transfer: insufficient balance");

      // solhint-disable avoid-low-level-calls
      (bool success, ) = payable(to).call{ value: value }("");
      require(success, "Transfer: Unable to send");
    } else {
      require(IERC20(token).transfer(to, value), "Transfer: Unable to send");
    }
  }
}
