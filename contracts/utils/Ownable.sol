// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

abstract contract Ownable {
  address private _owner;

  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  constructor() {
    _setOwner(msg.sender);
  }

  function owner() public view returns (address) {
    return _owner;
  }

  modifier onlyOwner() {
    require(owner() == msg.sender, "Ownable: caller is not the owner");
    _;
  }

  function renounceOwnership() public onlyOwner {
    _setOwner(address(0));
  }

  function transferOwnership(address newOwner) public onlyOwner {
    require(newOwner != address(0), "Ownable: Invalid owner");
    _setOwner(newOwner);
  }

  function _setOwner(address newOwner) private {
    address oldOwner = _owner;
    _owner = newOwner;
    emit OwnershipTransferred(oldOwner, newOwner);
  }
}
