// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ═══════════════════════════════════════════════════════════════════
// TradingEngine.sol — Order matching engine using FHE
//
// CORE FHE USAGE:
// • Compares encrypted buy price ≥ encrypted sell price (TFHE.le)
// • Calculates fill amounts on encrypted values (TFHE.min, TFHE.sub)
// • Settles trades by mutating encrypted balances in the Vault
// • The matching logic NEVER sees plaintext prices or amounts
//
// This is the most FHE-intensive contract in the protocol:
// every comparison, arithmetic op, and conditional runs on ciphertexts.
// ═══════════════════════════════════════════════════════════════════

import "fhevm/lib/TFHE.sol";
import "./OrderBook.sol";
import "./Vault.sol";

contract TradingEngine is AccessControl {

    // ─── State ───────────────────────────────────────────────────
    OrderBook public orderBook;
    Vault public vault;

    // Match tracking
    uint256 public totalMatches;

    struct MatchResult {
        uint256 buyOrderId;
        uint256 sellOrderId;
        uint256 timestamp;
        bool executed;
    }
    mapping(uint256 => MatchResult) public matches;

    // ─── Events ──────────────────────────────────────────────────
    event TradeExecuted(
        uint256 indexed matchId,
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        address baseToken,
        address quoteToken,
        uint256 timestamp
    );
    event MatchAttempted(uint256 buyOrderId, uint256 sellOrderId, bool success);

    // ─── Errors ──────────────────────────────────────────────────
    error OrdersNotCompatible();
    error OrderNotOpen();
    error SameSide();
    error DifferentPairs();

    // ─── Constructor ─────────────────────────────────────────────
    constructor(address _orderBook, address _vault) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        orderBook = OrderBook(_orderBook);
        vault = Vault(_vault);
    }

    // ─── Core Matching Logic ─────────────────────────────────────

    /// @notice Attempt to match a buy order with a sell order.
    ///
    /// FHE MATCHING ALGORITHM:
    ///   1. Load encrypted prices & amounts from both orders
    ///   2. Check: encrypted buy price ≥ encrypted sell price
    ///      → TFHE.le(sellPrice, buyPrice) returns ebool
    ///   3. Calculate fill amount: min(buyRemaining, sellRemaining)
    ///      → TFHE.min() on encrypted remaining amounts
    ///   4. Calculate quote cost: fillAmount * executionPrice
    ///      → TFHE.mul() on encrypted values
    ///   5. Update encrypted balances in Vault
    ///   6. Update encrypted filled amounts in OrderBook
    ///
    /// ALL of steps 2-6 operate on CIPHERTEXTS. The contract
    /// never learns the actual prices, amounts, or fill sizes.
    ///
    /// @param buyOrderId  The buy order to match
    /// @param sellOrderId The sell order to match against
    function matchOrders(uint256 buyOrderId, uint256 sellOrderId) external {
        // ── Step 1: Load order data ──────────────────────────────
        (
            address buyTrader,
            address buyBase,
            address buyQuote,
            OrderBook.OrderSide buySide,
            OrderBook.OrderType,
            euint64 buyEncPrice,
            euint64 buyEncAmount,
            euint64 buyEncFilled,
            OrderBook.OrderStatus buyStatus
        ) = orderBook.getOrderForMatching(buyOrderId);

        (
            address sellTrader,
            address sellBase,
            address sellQuote,
            OrderBook.OrderSide sellSide,
            OrderBook.OrderType,
            euint64 sellEncPrice,
            euint64 sellEncAmount,
            euint64 sellEncFilled,
            OrderBook.OrderStatus sellStatus
        ) = orderBook.getOrderForMatching(sellOrderId);

        // ── Validation (plaintext checks on metadata) ────────────
        if (buySide != OrderBook.OrderSide.BUY || sellSide != OrderBook.OrderSide.SELL) revert SameSide();
        if (buyBase != sellBase || buyQuote != sellQuote) revert DifferentPairs();
        if (buyStatus != OrderBook.OrderStatus.OPEN && buyStatus != OrderBook.OrderStatus.PARTIALLY_FILLED) revert OrderNotOpen();
        if (sellStatus != OrderBook.OrderStatus.OPEN && sellStatus != OrderBook.OrderStatus.PARTIALLY_FILLED) revert OrderNotOpen();

        // ── Step 2: FHE Price Comparison ─────────────────────────
        // ╔═══════════════════════════════════════════════════════╗
        // ║  ENCRYPTED COMPARISON: Is buy price ≥ sell price?    ║
        // ║                                                       ║
        // ║  TFHE.le(sellPrice, buyPrice) → ebool                ║
        // ║                                                       ║
        // ║  Returns an ENCRYPTED boolean. We decrypt ONLY this  ║
        // ║  boolean — not the prices themselves. This reveals    ║
        // ║  only "compatible or not", not actual price values.   ║
        // ╚═══════════════════════════════════════════════════════╝
        ebool pricesCompatible = TFHE.le(sellEncPrice, buyEncPrice);
        TFHE.allow(pricesCompatible, address(this));

        // Decrypt ONLY the boolean result (not the prices!)
        bool canMatch = TFHE.decrypt(pricesCompatible);
        if (!canMatch) {
            emit MatchAttempted(buyOrderId, sellOrderId, false);
            return; // Prices don't cross — no trade
        }

        // ── Step 3: Calculate Remaining Amounts (Encrypted) ──────
        // ╔═══════════════════════════════════════════════════════╗
        // ║  ENCRYPTED ARITHMETIC:                                ║
        // ║  buyRemaining  = buyAmount  - buyFilled               ║
        // ║  sellRemaining = sellAmount - sellFilled              ║
        // ║  Both computations happen on ciphertexts              ║
        // ╚═══════════════════════════════════════════════════════╝
        euint64 buyRemaining = TFHE.sub(buyEncAmount, buyEncFilled);
        euint64 sellRemaining = TFHE.sub(sellEncAmount, sellEncFilled);

        // ── Step 4: Determine Fill Amount ────────────────────────
        // ╔═══════════════════════════════════════════════════════╗
        // ║  ENCRYPTED MIN: Fill = min(buyRemaining, sellRemain) ║
        // ║  TFHE.min() returns the smaller encrypted value       ║
        // ║  without revealing which is smaller                   ║
        // ╚═══════════════════════════════════════════════════════╝
        euint64 fillAmount = TFHE.min(buyRemaining, sellRemaining);

        // ── Step 5: Calculate Cost (Price × Amount) ──────────────
        // ╔═══════════════════════════════════════════════════════╗
        // ║  ENCRYPTED MULTIPLICATION:                            ║
        // ║  Execute at the sell price (price improvement for     ║
        // ║  the buyer). quoteCost = fillAmount * sellPrice       ║
        // ║  All encrypted — no one sees the actual trade size    ║
        // ╚═══════════════════════════════════════════════════════╝
        euint64 quoteCost = TFHE.mul(fillAmount, sellEncPrice);

        // Allow vault to use these encrypted values
        TFHE.allow(fillAmount, address(vault));
        TFHE.allow(quoteCost, address(vault));
        TFHE.allow(fillAmount, address(this));
        TFHE.allow(quoteCost, address(this));

        // ── Step 6: Settlement — Update Encrypted Balances ───────
        // ╔═══════════════════════════════════════════════════════╗
        // ║  ENCRYPTED SETTLEMENT:                                ║
        // ║                                                       ║
        // ║  Buyer:                                               ║
        // ║    - Receives: fillAmount of baseToken (encrypted +)  ║
        // ║    - Pays:     quoteCost of quoteToken (encrypted -)  ║
        // ║                                                       ║
        // ║  Seller:                                              ║
        // ║    - Pays:     fillAmount of baseToken (encrypted -)  ║
        // ║    - Receives: quoteCost of quoteToken (encrypted +)  ║
        // ║                                                       ║
        // ║  All four operations use TFHE.add() and TFHE.sub()   ║
        // ║  on encrypted vault balances. No plaintext exposed.   ║
        // ╚═══════════════════════════════════════════════════════╝

        // Buyer: +base, -quote
        vault.addEncryptedBalance(buyTrader, buyBase, fillAmount);
        vault.subEncryptedBalance(buyTrader, buyQuote, quoteCost);

        // Seller: -base, +quote
        vault.subEncryptedBalance(sellTrader, sellBase, fillAmount);
        vault.addEncryptedBalance(sellTrader, sellQuote, quoteCost);

        // ── Step 7: Update Order Fill Status ─────────────────────
        euint64 newBuyFilled = TFHE.add(buyEncFilled, fillAmount);
        euint64 newSellFilled = TFHE.add(sellEncFilled, fillAmount);

        TFHE.allow(newBuyFilled, address(orderBook));
        TFHE.allow(newSellFilled, address(orderBook));

        // Determine if orders are fully filled using encrypted comparison
        ebool buyFullyFilled = TFHE.eq(newBuyFilled, buyEncAmount);
        ebool sellFullyFilled = TFHE.eq(newSellFilled, sellEncAmount);

        TFHE.allow(buyFullyFilled, address(this));
        TFHE.allow(sellFullyFilled, address(this));

        bool buyDone = TFHE.decrypt(buyFullyFilled);
        bool sellDone = TFHE.decrypt(sellFullyFilled);

        orderBook.updateOrderFill(
            buyOrderId,
            newBuyFilled,
            buyDone ? OrderBook.OrderStatus.FILLED : OrderBook.OrderStatus.PARTIALLY_FILLED
        );

        orderBook.updateOrderFill(
            sellOrderId,
            newSellFilled,
            sellDone ? OrderBook.OrderStatus.FILLED : OrderBook.OrderStatus.PARTIALLY_FILLED
        );

        // ── Record Match ─────────────────────────────────────────
        uint256 matchId = totalMatches++;
        matches[matchId] = MatchResult({
            buyOrderId: buyOrderId,
            sellOrderId: sellOrderId,
            timestamp: block.timestamp,
            executed: true
        });

        emit TradeExecuted(matchId, buyOrderId, sellOrderId, buyBase, buyQuote, block.timestamp);
        emit MatchAttempted(buyOrderId, sellOrderId, true);
    }

    // ─── Batch Matching ──────────────────────────────────────────

    /// @notice Try to match multiple order pairs in one transaction
    /// @dev Useful for keepers/relayers running the matching engine off-chain
    function batchMatch(
        uint256[] calldata buyOrderIds,
        uint256[] calldata sellOrderIds
    ) external {
        require(buyOrderIds.length == sellOrderIds.length, "Array length mismatch");
        for (uint256 i = 0; i < buyOrderIds.length; i++) {
            // Each match is independent — failures don't revert the batch
            try this.matchOrders(buyOrderIds[i], sellOrderIds[i]) {
                // Success — event emitted inside matchOrders
            } catch {
                emit MatchAttempted(buyOrderIds[i], sellOrderIds[i], false);
            }
        }
    }

    // ─── View Functions ──────────────────────────────────────────

    function getMatch(uint256 matchId) external view returns (MatchResult memory) {
        return matches[matchId];
    }
}
