// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ═══════════════════════════════════════════════════════════════════
// OrderBook.sol — Encrypted order book using Zama fhEVM
//
// CORE FHE USAGE:
// • Order prices and amounts stored as euint64 (encrypted)
// • No one can see pending order details → prevents front-running
// • Only the order owner can view their own order details
// • Matching engine uses FHE comparisons on encrypted values
// ═══════════════════════════════════════════════════════════════════

import "fhevm/lib/TFHE.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract OrderBook is AccessControl {

    // ─── Types ───────────────────────────────────────────────────
    enum OrderSide { BUY, SELL }
    enum OrderType { MARKET, LIMIT }
    enum OrderStatus { OPEN, FILLED, PARTIALLY_FILLED, CANCELLED }

    /// @notice Each order's price and amount are ENCRYPTED.
    ///         Only the trader can decrypt their own order details.
    struct Order {
        uint256 id;
        address trader;
        address baseToken;      // e.g., WBTC
        address quoteToken;     // e.g., USDC
        OrderSide side;
        OrderType orderType;
        euint64 encPrice;       // Encrypted limit price (in quote token units)
        euint64 encAmount;      // Encrypted order size (in base token units)
        euint64 encFilled;      // Encrypted filled amount
        OrderStatus status;
        uint256 timestamp;
    }

    // ─── Roles ───────────────────────────────────────────────────
    bytes32 public constant ENGINE_ROLE = keccak256("ENGINE_ROLE");

    // ─── State ───────────────────────────────────────────────────
    mapping(uint256 => Order) private _orders;
    uint256 public nextOrderId;

    // Trading pair indices: pairHash => orderId[]
    mapping(bytes32 => uint256[]) private _buyOrders;
    mapping(bytes32 => uint256[]) private _sellOrders;

    // User order tracking
    mapping(address => uint256[]) private _userOrders;

    // Supported trading pairs
    mapping(bytes32 => bool) public supportedPairs;
    bytes32[] public pairList;

    // ─── Events ──────────────────────────────────────────────────
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        address baseToken,
        address quoteToken,
        OrderSide side,
        OrderType orderType,
        uint256 timestamp
    );
    event OrderStatusChanged(uint256 indexed orderId, OrderStatus newStatus);
    event OrderCancelled(uint256 indexed orderId, address indexed trader);
    event PairAdded(address indexed baseToken, address indexed quoteToken);

    // ─── Errors ──────────────────────────────────────────────────
    error PairNotSupported();
    error NotOrderOwner();
    error OrderNotOpen();
    error InvalidOrderType();

    // ─── Constructor ─────────────────────────────────────────────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ─── Admin ───────────────────────────────────────────────────

    function addTradingPair(address baseToken, address quoteToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 pairHash = getPairHash(baseToken, quoteToken);
        supportedPairs[pairHash] = true;
        pairList.push(pairHash);
        emit PairAdded(baseToken, quoteToken);
    }

    function setTradingEngine(address engine) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ENGINE_ROLE, engine);
    }

    // ─── Order Placement ─────────────────────────────────────────

    /// @notice Place an order with encrypted price and amount.
    ///
    /// FHE FLOW:
    ///   1. User encrypts price and amount in their browser using the
    ///      network's FHE public key
    ///   2. Encrypted values (einput) are submitted with ZK proofs
    ///   3. TFHE.asEuint64() verifies the proof and creates on-chain
    ///      encrypted values that can be computed on
    ///   4. Order is stored — NO ONE can see price or amount
    ///   5. When matching occurs, FHE comparisons determine compatibility
    ///
    /// ANTI-FRONT-RUNNING:
    ///   Since prices are encrypted, MEV searchers cannot:
    ///   - Read pending order prices
    ///   - Sandwich attack with optimized prices
    ///   - Copy limit order strategies
    function placeOrder(
        address baseToken,
        address quoteToken,
        OrderSide side,
        OrderType orderType,
        einput encryptedPrice,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external returns (uint256 orderId) {
        bytes32 pairHash = getPairHash(baseToken, quoteToken);
        if (!supportedPairs[pairHash]) revert PairNotSupported();

        orderId = nextOrderId++;

        // ╔═══════════════════════════════════════════════════════╗
        // ║  FHE INPUT CONVERSION: Verify proof and create       ║
        // ║  on-chain encrypted values from user's einput         ║
        // ╚═══════════════════════════════════════════════════════╝
        euint64 price = TFHE.asEuint64(encryptedPrice, inputProof);
        euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);

        // Initialize filled amount to encrypted zero
        euint64 filled = TFHE.asEuint64(0);

        // Store the order with all encrypted fields
        _orders[orderId] = Order({
            id: orderId,
            trader: msg.sender,
            baseToken: baseToken,
            quoteToken: quoteToken,
            side: side,
            orderType: orderType,
            encPrice: price,
            encAmount: amount,
            encFilled: filled,
            status: OrderStatus.OPEN,
            timestamp: block.timestamp
        });

        // ╔═══════════════════════════════════════════════════════╗
        // ║  FHE ACCESS CONTROL: Grant permissions for who can   ║
        // ║  operate on these encrypted values                    ║
        // ║  - Contract itself (for matching logic)               ║
        // ║  - The trader (for viewing their own orders)          ║
        // ╚═══════════════════════════════════════════════════════╝
        TFHE.allow(price, address(this));
        TFHE.allow(price, msg.sender);
        TFHE.allow(amount, address(this));
        TFHE.allow(amount, msg.sender);
        TFHE.allow(filled, address(this));
        TFHE.allow(filled, msg.sender);

        // Index the order for matching
        if (side == OrderSide.BUY) {
            _buyOrders[pairHash].push(orderId);
        } else {
            _sellOrders[pairHash].push(orderId);
        }
        _userOrders[msg.sender].push(orderId);

        emit OrderPlaced(orderId, msg.sender, baseToken, quoteToken, side, orderType, block.timestamp);
    }

    // ─── Order Cancellation ──────────────────────────────────────

    /// @notice Cancel an open order. Only the original trader can cancel.
    function cancelOrder(uint256 orderId) external {
        Order storage order = _orders[orderId];
        if (order.trader != msg.sender) revert NotOrderOwner();
        if (order.status != OrderStatus.OPEN && order.status != OrderStatus.PARTIALLY_FILLED) {
            revert OrderNotOpen();
        }

        order.status = OrderStatus.CANCELLED;
        emit OrderCancelled(orderId, msg.sender);
    }

    // ─── Engine-Only Functions ───────────────────────────────────

    /// @notice Get encrypted order details for matching (engine only)
    function getOrderForMatching(uint256 orderId) external view onlyRole(ENGINE_ROLE) returns (
        address trader,
        address baseToken,
        address quoteToken,
        OrderSide side,
        OrderType orderType,
        euint64 encPrice,
        euint64 encAmount,
        euint64 encFilled,
        OrderStatus status
    ) {
        Order storage o = _orders[orderId];
        return (
            o.trader, o.baseToken, o.quoteToken,
            o.side, o.orderType,
            o.encPrice, o.encAmount, o.encFilled,
            o.status
        );
    }

    /// @notice Update order after partial/full fill
    function updateOrderFill(
        uint256 orderId,
        euint64 newFilled,
        OrderStatus newStatus
    ) external onlyRole(ENGINE_ROLE) {
        Order storage o = _orders[orderId];
        o.encFilled = newFilled;
        o.status = newStatus;
        TFHE.allow(newFilled, address(this));
        TFHE.allow(newFilled, o.trader);
        emit OrderStatusChanged(orderId, newStatus);
    }

    // ─── View Functions ──────────────────────────────────────────

    /// @notice Get public (non-encrypted) order metadata
    function getOrderMetadata(uint256 orderId) external view returns (
        address trader,
        address baseToken,
        address quoteToken,
        OrderSide side,
        OrderType orderType,
        OrderStatus status,
        uint256 timestamp
    ) {
        Order storage o = _orders[orderId];
        return (o.trader, o.baseToken, o.quoteToken, o.side, o.orderType, o.status, o.timestamp);
    }

    /// @notice Get user's own encrypted order details via reencryption
    function getMyOrderDetails(
        uint256 orderId,
        bytes32 publicKey,
        bytes calldata signature
    ) external view returns (bytes memory encPrice, bytes memory encAmount, bytes memory encFilled) {
        Order storage o = _orders[orderId];
        require(o.trader == msg.sender, "Not your order");

        encPrice = TFHE.reencrypt(o.encPrice, publicKey, 0);
        encAmount = TFHE.reencrypt(o.encAmount, publicKey, 0);
        encFilled = TFHE.reencrypt(o.encFilled, publicKey, 0);
    }

    function getBuyOrders(address baseToken, address quoteToken) external view returns (uint256[] memory) {
        return _buyOrders[getPairHash(baseToken, quoteToken)];
    }

    function getSellOrders(address baseToken, address quoteToken) external view returns (uint256[] memory) {
        return _sellOrders[getPairHash(baseToken, quoteToken)];
    }

    function getUserOrders(address user) external view returns (uint256[] memory) {
        return _userOrders[user];
    }

    // ─── Helpers ─────────────────────────────────────────────────

    function getPairHash(address baseToken, address quoteToken) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(baseToken, quoteToken));
    }
}
