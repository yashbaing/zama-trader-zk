// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";

/// @title IVault - Interface for the encrypted vault system
interface IVault {
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event BalanceUpdated(address indexed user, address indexed token);

    function deposit(address token, uint256 amount) external;
    function withdraw(address token, einput encryptedAmount, bytes calldata inputProof) external;
    function getEncryptedBalance(address token, bytes32 publicKey, bytes calldata signature) external view returns (bytes memory);
    function addEncryptedBalance(address user, address token, euint64 amount) external;
    function subEncryptedBalance(address user, address token, euint64 amount) external;
}

/// @title IOrderBook - Interface for the encrypted order book
interface IOrderBook {
    enum OrderSide { BUY, SELL }
    enum OrderType { MARKET, LIMIT }
    enum OrderStatus { OPEN, FILLED, PARTIALLY_FILLED, CANCELLED }

    struct EncryptedOrder {
        uint256 id;
        address trader;
        address baseToken;
        address quoteToken;
        OrderSide side;
        OrderType orderType;
        euint64 encryptedPrice;    // Encrypted limit price (0 for market)
        euint64 encryptedAmount;   // Encrypted order amount
        euint64 encryptedFilled;   // Encrypted filled amount
        OrderStatus status;
        uint256 timestamp;
    }

    event OrderPlaced(uint256 indexed orderId, address indexed trader, OrderSide side, OrderType orderType);
    event OrderMatched(uint256 indexed buyOrderId, uint256 indexed sellOrderId);
    event OrderCancelled(uint256 indexed orderId);

    function placeOrder(
        address baseToken,
        address quoteToken,
        OrderSide side,
        OrderType orderType,
        einput encryptedPrice,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external returns (uint256 orderId);

    function cancelOrder(uint256 orderId) external;
}

/// @title ITradingEngine - Interface for the FHE matching engine
interface ITradingEngine {
    event TradeExecuted(
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        address baseToken,
        address quoteToken
    );

    function matchOrders(uint256 buyOrderId, uint256 sellOrderId) external;
}
