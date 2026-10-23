// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Disperse} from "../src/Disperse.sol";

contract Deploy is Script {
    function run() external returns (Disperse d) {
        vm.startBroadcast();
        d = new Disperse();
        vm.stopBroadcast();
        console.log("Disperse:", address(d));
    }
}
