// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract AuthorityReceipt {
    error ZeroAddress(); error NotController();
    address public immutable controller; bytes32 public immutable workflow;
    event AuthorityAction(bytes32 indexed workflow, address indexed actor, bytes32 indexed action, uint256 blockNumber);
    constructor(address controller_, bytes32 workflow_) { if (controller_ == address(0) || workflow_ == bytes32(0)) revert ZeroAddress(); controller = controller_; workflow = workflow_; }
    function recordAction(bytes32 action) external { if (msg.sender != controller) revert NotController(); if (action == bytes32(0)) revert ZeroAddress(); emit AuthorityAction(workflow, msg.sender, action, block.number); }
}
