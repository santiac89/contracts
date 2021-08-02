// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract WhitelistedTokens is Ownable {
  mapping(address => bool) public whitelistedTokens;

  constructor() {
    whitelistedTokens[address(0)] = true;
  }

  modifier isWhitelisted(address token) {
    require(whitelistedTokens[token], "Whitelist: Token not whitelisted");
    _;
  }

  function whitelistToken(address token) external onlyOwner {
    whitelistedTokens[token] = true;
  }

  function removeFromWhitelist(address token) external onlyOwner {
    delete whitelistedTokens[token];
  }
}
