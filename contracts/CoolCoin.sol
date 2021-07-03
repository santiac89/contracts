// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./core/BEP20Token.sol";

contract CoolCoin is BEP20Token {
  constructor() BEP20Token("CoolCoin", "COOL", 18, 1e27) {}
}
