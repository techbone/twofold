// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {NativeAsset} from "./NativeAsset.sol";

/// @title Disperse
/// @notice Batch payouts of any Portaldot native asset (or any ERC-20) from one approval.
/// @dev Pulls each amount straight from the sender to the recipient, so the contract
///      never holds funds.
contract Disperse {
    event Dispersed(
        address indexed token, address indexed sender, uint256 recipients, uint256 total
    );

    error LengthMismatch();
    error TransferFailed(address to, uint256 amount);

    function disperseAsset(uint32 assetId, address[] calldata to, uint256[] calldata amounts)
        external
    {
        _disperse(NativeAsset.toAddress(assetId), to, amounts);
    }

    function disperseToken(address token, address[] calldata to, uint256[] calldata amounts)
        external
    {
        _disperse(token, to, amounts);
    }

    function _disperse(address token, address[] calldata to, uint256[] calldata amounts) private {
        if (to.length != amounts.length) revert LengthMismatch();
        uint256 total;
        for (uint256 i; i < to.length; ++i) {
            (bool ok, bytes memory ret) = token.call(
                abi.encodeWithSelector(0x23b872dd, msg.sender, to[i], amounts[i]) // transferFrom
            );
            if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
                revert TransferFailed(to[i], amounts[i]);
            }
            total += amounts[i];
        }
        emit Dispersed(token, msg.sender, to.length, total);
    }
}
