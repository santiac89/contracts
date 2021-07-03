// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CoolCoin is ERC20 {
  constructor(uint256 initialSupply) ERC20("CoolCoin", "COOL") {
    _mint(msg.sender, initialSupply);
  }
}
