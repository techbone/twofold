// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Disperse} from "../src/Disperse.sol";
import {NativeAsset} from "../src/NativeAsset.sol";

/// Minimal stand-in for the pallet-assets ERC-20 precompile, etched at the asset's address.
contract MockAsset {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public fail;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function setFail(bool f) external {
        fail = f;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (fail) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract NativeAssetTest is Test {
    function test_toAddress_matchesLivePusd() public pure {
        assertEq(NativeAsset.toAddress(7777), 0x00001E6100000000000000000000000000010000);
    }

    function test_toAddress_matchesLiveRusd() public pure {
        assertEq(NativeAsset.toAddress(7770), 0x00001e5a00000000000000000000000000010000);
    }

    function testFuzz_roundTrip(uint32 id) public pure {
        address a = NativeAsset.toAddress(id);
        assertTrue(NativeAsset.isNativeAsset(a));
        assertEq(NativeAsset.toAssetId(a), id);
    }

    function test_isNativeAsset_rejectsContracts() public pure {
        assertFalse(NativeAsset.isNativeAsset(0xe0114Adc0a2072B602C645f5a07EeFA1eaDBDbc2));
    }

    function test_toAssetId_revertsOnNonAsset() public {
        vm.expectRevert(
            abi.encodeWithSelector(NativeAsset.NotNativeAsset.selector, address(0xBEEF))
        );
        this.callToAssetId(address(0xBEEF));
    }

    function callToAssetId(address a) external pure returns (uint32) {
        return NativeAsset.toAssetId(a);
    }
}

contract DisperseTest is Test {
    uint32 constant ASSET_ID = 7777;
    Disperse disperse;
    MockAsset asset;
    address sender = makeAddr("sender");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        disperse = new Disperse();
        address at = NativeAsset.toAddress(ASSET_ID);
        vm.etch(at, address(new MockAsset()).code);
        asset = MockAsset(at);
        asset.mint(sender, 1_000e6);
        vm.prank(sender);
        asset.approve(address(disperse), type(uint256).max);
    }

    function _pair() internal view returns (address[] memory to, uint256[] memory amounts) {
        to = new address[](2);
        to[0] = alice;
        to[1] = bob;
        amounts = new uint256[](2);
        amounts[0] = 100e6;
        amounts[1] = 250e6;
    }

    function test_disperseAsset_paysEachRecipient() public {
        (address[] memory to, uint256[] memory amounts) = _pair();
        vm.expectEmit(address(disperse));
        emit Disperse.Dispersed(address(asset), sender, 2, 350e6);
        vm.prank(sender);
        disperse.disperseAsset(ASSET_ID, to, amounts);
        assertEq(asset.balanceOf(alice), 100e6);
        assertEq(asset.balanceOf(bob), 250e6);
        assertEq(asset.balanceOf(sender), 650e6);
        assertEq(asset.balanceOf(address(disperse)), 0);
    }

    function test_disperseToken_sameAsAssetPath() public {
        (address[] memory to, uint256[] memory amounts) = _pair();
        vm.prank(sender);
        disperse.disperseToken(address(asset), to, amounts);
        assertEq(asset.balanceOf(bob), 250e6);
    }

    function test_revertsOnLengthMismatch() public {
        (address[] memory to,) = _pair();
        vm.prank(sender);
        vm.expectRevert(Disperse.LengthMismatch.selector);
        disperse.disperseAsset(ASSET_ID, to, new uint256[](1));
    }

    function test_revertsWhenPrecompileReturnsFalse() public {
        (address[] memory to, uint256[] memory amounts) = _pair();
        asset.setFail(true);
        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(Disperse.TransferFailed.selector, alice, 100e6));
        disperse.disperseAsset(ASSET_ID, to, amounts);
    }

    function test_revertsWithoutAllowance() public {
        (address[] memory to, uint256[] memory amounts) = _pair();
        vm.prank(alice);
        vm.expectRevert();
        disperse.disperseAsset(ASSET_ID, to, amounts);
    }
}
