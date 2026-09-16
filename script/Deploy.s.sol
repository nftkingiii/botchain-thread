// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script} from "forge-std/Script.sol"; import {AuthorityReceipt} from "../src/AuthorityReceipt.sol";
contract Deploy is Script { function run() external returns (AuthorityReceipt deployed) { address controller = vm.envAddress("BOT_LENS_CONTROLLER"); bytes32 workflow = vm.envBytes32("BOT_LENS_WORKFLOW"); vm.startBroadcast(); deployed = new AuthorityReceipt(controller, workflow); vm.stopBroadcast(); } }
