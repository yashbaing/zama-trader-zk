import { ethers } from "ethers";
import { config } from "../../config/index.js";

/**
 * Event Indexer Service
 *
 * SECURITY NOTE: This service indexes PUBLIC event data only.
 * Encrypted values (balances, prices, amounts) are NEVER decoded or stored here.
 * We only index:
 *   - Order placement metadata (orderId, trader, side, type, timestamp)
 *   - Trade execution metadata (matchId, buyId, sellId, tokens, timestamp)
 *   - Deposit/withdrawal events (user, token, plaintext deposit amounts)
 *
 * The backend CANNOT see:
 *   - Encrypted order prices or amounts
 *   - Encrypted fill sizes
 *   - User encrypted balances
 */

export interface IndexedOrder {
  id: number;
  trader: string;
  baseToken: string;
  quoteToken: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  status: "OPEN" | "FILLED" | "PARTIALLY_FILLED" | "CANCELLED";
  timestamp: number;
  blockNumber: number;
  txHash: string;
}

export interface IndexedTrade {
  matchId: number;
  buyOrderId: number;
  sellOrderId: number;
  baseToken: string;
  quoteToken: string;
  timestamp: number;
  blockNumber: number;
  txHash: string;
}

export interface IndexedDeposit {
  user: string;
  token: string;
  amount: string; // Plaintext — deposits are visible on-chain
  timestamp: number;
  blockNumber: number;
  txHash: string;
}

// In-memory stores (use a DB in production)
const orders: Map<number, IndexedOrder> = new Map();
const trades: IndexedTrade[] = [];
const deposits: IndexedDeposit[] = [];

let provider: ethers.JsonRpcProvider | null = null;

// Minimal ABIs — only the events we need to index
const VAULT_EVENTS_ABI = [
  "event Deposited(address indexed user, address indexed token, uint256 amount)",
  "event WithdrawalRequested(uint256 indexed requestId, address indexed user, address indexed token)",
  "event WithdrawalFulfilled(uint256 indexed requestId, address indexed user, uint256 amount)",
];

const ORDERBOOK_EVENTS_ABI = [
  "event OrderPlaced(uint256 indexed orderId, address indexed trader, address baseToken, address quoteToken, uint8 side, uint8 orderType, uint256 timestamp)",
  "event OrderStatusChanged(uint256 indexed orderId, uint8 newStatus)",
  "event OrderCancelled(uint256 indexed orderId, address indexed trader)",
];

const ENGINE_EVENTS_ABI = [
  "event TradeExecuted(uint256 indexed matchId, uint256 indexed buyOrderId, uint256 indexed sellOrderId, address baseToken, address quoteToken, uint256 timestamp)",
];

function isValidAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export function initializeIndexer() {
  if (!config.rpcUrl) {
    console.warn("No RPC URL configured — indexer disabled");
    return;
  }

  provider = new ethers.JsonRpcProvider(config.rpcUrl);

  if (isValidAddress(config.contracts.vault)) {
    const vaultContract = new ethers.Contract(config.contracts.vault, VAULT_EVENTS_ABI, provider);
    vaultContract.on("Deposited", (user, token, amount, event) => {
      deposits.push({
        user,
        token,
        amount: amount.toString(),
        timestamp: Date.now(),
        blockNumber: event.log.blockNumber,
        txHash: event.log.transactionHash,
      });
    });
  } else {
    console.warn("Invalid or missing VAULT_ADDRESS — vault event indexing disabled");
  }

  if (isValidAddress(config.contracts.orderBook)) {
    const orderBookContract = new ethers.Contract(config.contracts.orderBook, ORDERBOOK_EVENTS_ABI, provider);

    orderBookContract.on("OrderPlaced", (orderId, trader, baseToken, quoteToken, side, orderType, timestamp, event) => {
      orders.set(Number(orderId), {
        id: Number(orderId),
        trader,
        baseToken,
        quoteToken,
        side: side === 0 ? "BUY" : "SELL",
        orderType: orderType === 0 ? "MARKET" : "LIMIT",
        status: "OPEN",
        timestamp: Number(timestamp),
        blockNumber: event.log.blockNumber,
        txHash: event.log.transactionHash,
      });
    });

    orderBookContract.on("OrderStatusChanged", (orderId, newStatus) => {
      const order = orders.get(Number(orderId));
      if (order) {
        const statusMap = ["OPEN", "FILLED", "PARTIALLY_FILLED", "CANCELLED"] as const;
        order.status = statusMap[newStatus] || "OPEN";
      }
    });
  } else {
    console.warn("Invalid or missing ORDER_BOOK_ADDRESS — orderbook event indexing disabled");
  }

  if (isValidAddress(config.contracts.tradingEngine)) {
    const engineContract = new ethers.Contract(config.contracts.tradingEngine, ENGINE_EVENTS_ABI, provider);

    engineContract.on("TradeExecuted", (matchId, buyOrderId, sellOrderId, baseToken, quoteToken, timestamp, event) => {
      trades.push({
        matchId: Number(matchId),
        buyOrderId: Number(buyOrderId),
        sellOrderId: Number(sellOrderId),
        baseToken,
        quoteToken,
        timestamp: Number(timestamp),
        blockNumber: event.log.blockNumber,
        txHash: event.log.transactionHash,
      });
    });
  } else {
    console.warn("Invalid or missing TRADING_ENGINE_ADDRESS — trading engine event indexing disabled");
  }

  console.log("Event indexer initialized");
}

// Query functions (only PUBLIC metadata — no encrypted data)
export function getOrders(filters?: { trader?: string; pair?: string; status?: string }): IndexedOrder[] {
  let result = Array.from(orders.values());
  if (filters?.trader) result = result.filter((o) => o.trader.toLowerCase() === filters.trader!.toLowerCase());
  if (filters?.status) result = result.filter((o) => o.status === filters.status);
  return result.sort((a, b) => b.timestamp - a.timestamp);
}

export function getTrades(limit = 50): IndexedTrade[] {
  return trades.slice(-limit).reverse();
}

export function getDeposits(user?: string): IndexedDeposit[] {
  let result = [...deposits];
  if (user) result = result.filter((d) => d.user.toLowerCase() === user.toLowerCase());
  return result.sort((a, b) => b.timestamp - a.timestamp);
}

export function getTradeCount(): number {
  return trades.length;
}

export function getOrderCount(): number {
  return orders.size;
}
