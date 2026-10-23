// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title NativeAsset
/// @notice Maps Portaldot `pallet-assets` ids to their ERC-20 precompile addresses.
/// @dev Layout, verified against the live testnet (pUSD, id 7777):
///      bytes 0..4   asset id, big-endian u32
///      bytes 4..16  zero
///      bytes 16..18 0x0001 (local assets precompile prefix)
///      bytes 18..20 zero
///      7777 -> 0x00001e6100000000000000000000000000010000
library NativeAsset {
    uint160 internal constant PREFIX = 0x00010000;
    uint160 internal constant LOW_MASK = (uint160(1) << 128) - 1;

    error NotNativeAsset(address token);

    function toAddress(uint32 assetId) internal pure returns (address) {
        return address((uint160(assetId) << 128) | PREFIX);
    }

    function isNativeAsset(address token) internal pure returns (bool) {
        return uint160(token) & LOW_MASK == PREFIX;
    }

    function toAssetId(address token) internal pure returns (uint32) {
        if (!isNativeAsset(token)) revert NotNativeAsset(token);
        return uint32(uint160(token) >> 128);
    }
}
