// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ds/RedBlackTree.sol";

contract TestRedBlackTree {
  using RedBlackTree for Tree;

  Tree internal tree;

  event Log(string where, uint256 key, uint256 value);

  function root() public view returns (uint256 _key) {
    _key = tree.root;
  }

  function first() public view returns (uint256 _key) {
    _key = tree.first();
  }

  function last() public view returns (uint256 _key) {
    _key = tree.last();
  }

  function next(uint256 key) public view returns (uint256 _key) {
    _key = tree.next(key);
  }

  function prev(uint256 key) public view returns (uint256 _key) {
    _key = tree.prev(key);
  }

  function exists(uint256 key) public view returns (bool _exists) {
    _exists = tree.exists(key);
  }

  function insert(uint256 _key) public {
    tree.insert(_key);
    emit Log("insert", _key, 0);
  }

  function remove(uint256 _key) public {
    tree.remove(_key);
    emit Log("remove", _key, 0);
  }
}
