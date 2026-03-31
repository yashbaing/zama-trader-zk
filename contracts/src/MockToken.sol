// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockToken - ERC20 token for testnet trading pairs
/// @notice Mintable token representing BTC, ETH, SOL, or USDC on the Zama testnet
contract MockToken is ERC20, Ownable {
    uint8 private _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Mint tokens for testnet use — anyone can call (faucet-style)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Convenience: mint 1000 tokens to caller
    function faucet() external {
        _mint(msg.sender, 1000 * 10 ** _decimals);
    }
}
