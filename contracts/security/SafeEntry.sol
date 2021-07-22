// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

abstract contract SafeEntry is ReentrancyGuard {
  using Address for address;

  modifier notContract() {
    require(!Address.isContract(msg.sender), "Contract not allowed");

    // solhint-disable-next-line avoid-tx-origin
    require(msg.sender == tx.origin, "Proxy contract not allowed");
    _;
  }
}
