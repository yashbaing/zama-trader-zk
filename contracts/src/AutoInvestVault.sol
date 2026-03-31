// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ═══════════════════════════════════════════════════════════════════
// AutoInvestVault.sol — Strategy vault with encrypted positions
//
// FHE USAGE:
// • Strategy allocations stored as encrypted percentages
// • Rebalance amounts computed on encrypted values
// • No one can see a user's investment strategy
// ═══════════════════════════════════════════════════════════════════

import "fhevm/lib/TFHE.sol";
import "./Vault.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AutoInvestVault is AccessControl {

    Vault public vault;

    enum MarketSentiment { EXTREME_FEAR, FEAR, NEUTRAL, GREED, EXTREME_GREED }

    // Each user's strategy: how much to allocate per asset at each sentiment level
    // All percentages are encrypted — no one can see the strategy
    struct EncryptedStrategy {
        mapping(address => mapping(MarketSentiment => euint64)) allocationPct; // encrypted 0-100
        address[] tokens;
        bool active;
    }

    mapping(address => EncryptedStrategy) private _strategies;

    // Current market sentiment (updated by oracle/keeper)
    MarketSentiment public currentSentiment;
    uint256 public lastSentimentUpdate;

    event StrategySet(address indexed user);
    event SentimentUpdated(MarketSentiment sentiment, uint256 timestamp);
    event Rebalanced(address indexed user, uint256 timestamp);

    constructor(address _vault) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        vault = Vault(_vault);
    }

    /// @notice Set allocation percentage for a token at a given sentiment level
    /// @dev The percentage is encrypted — strategy remains private
    ///
    /// FHE: User encrypts their desired allocation percentage (0-100)
    ///      and submits it. The contract stores it encrypted.
    ///      Example: "When market is in FEAR, put 60% in BTC, 30% in ETH, 10% in SOL"
    ///      All three percentages are encrypted independently.
    function setAllocation(
        address token,
        MarketSentiment sentiment,
        einput encryptedPct,
        bytes calldata inputProof
    ) external {
        euint64 pct = TFHE.asEuint64(encryptedPct, inputProof);
        TFHE.allow(pct, address(this));
        TFHE.allow(pct, msg.sender);

        EncryptedStrategy storage strategy = _strategies[msg.sender];
        strategy.allocationPct[token][sentiment] = pct;

        // Track token if new
        bool found = false;
        for (uint i = 0; i < strategy.tokens.length; i++) {
            if (strategy.tokens[i] == token) { found = true; break; }
        }
        if (!found) strategy.tokens.push(token);

        strategy.active = true;
        emit StrategySet(msg.sender);
    }

    /// @notice Update the market sentiment (keeper/oracle function)
    function updateSentiment(MarketSentiment sentiment) external onlyRole(DEFAULT_ADMIN_ROLE) {
        currentSentiment = sentiment;
        lastSentimentUpdate = block.timestamp;
        emit SentimentUpdated(sentiment, block.timestamp);
    }

    /// @notice Get user's encrypted allocation for a token at current sentiment
    function getMyAllocation(
        address token,
        MarketSentiment sentiment,
        bytes32 publicKey,
        bytes calldata signature
    ) external view returns (bytes memory) {
        return TFHE.reencrypt(
            _strategies[msg.sender].allocationPct[token][sentiment],
            publicKey,
            0
        );
    }

    function isStrategyActive(address user) external view returns (bool) {
        return _strategies[user].active;
    }
}
