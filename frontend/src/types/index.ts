// ─── Token Types ─────────────────────────────────────────────────

export interface Token {
  key: string;
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  icon: string;
  coingeckoId: string;
}

export interface TradingPair {
  base: Token;
  quote: Token;
  pairSymbol: string; // e.g., "BTC/USDC"
}

// ─── Price Types ─────────────────────────────────────────────────

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  lastUpdated: string;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// ─── Order Types ─────────────────────────────────────────────────

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT";
export type OrderStatus = "OPEN" | "FILLED" | "PARTIALLY_FILLED" | "CANCELLED";

export interface Order {
  id: number;
  trader: string;
  baseToken: string;
  quoteToken: string;
  side: OrderSide;
  orderType: OrderType;
  status: OrderStatus;
  timestamp: number;
  // Decrypted values (only available to the order owner)
  decryptedPrice?: number;
  decryptedAmount?: number;
  decryptedFilled?: number;
}

// ─── Trade Types ─────────────────────────────────────────────────

export interface Trade {
  matchId: number;
  buyOrderId: number;
  sellOrderId: number;
  baseToken: string;
  quoteToken: string;
  timestamp: number;
  blockNumber: number;
  txHash: string;
}

// ─── Vault Types ─────────────────────────────────────────────────

export interface VaultBalance {
  token: Token;
  encryptedBalance: string; // Hex-encoded encrypted value
  decryptedBalance?: number; // Only after client-side decryption
  usdValue?: number;
}

export interface DepositEvent {
  user: string;
  token: string;
  amount: string;
  timestamp: number;
  txHash: string;
}

// ─── Wallet Types ────────────────────────────────────────────────

export interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  fhePublicKey: string | null;
  fheKeypair: any | null; // fhevmjs keypair type
}

// ─── Auto-Invest Types ──────────────────────────────────────────

export type MarketSentiment =
  | "EXTREME_FEAR"
  | "FEAR"
  | "NEUTRAL"
  | "GREED"
  | "EXTREME_GREED";

export interface AutoInvestStrategy {
  token: string;
  allocations: Record<MarketSentiment, number>; // Decrypted percentages
  active: boolean;
}

// ─── Protocol Stats ──────────────────────────────────────────────

export interface ProtocolStats {
  totalTrades: number;
  totalOrders: number;
  supportedTokens: number;
  tradingPairs: number;
  chain: string;
  chainId: number;
}

// ─── API Responses ───────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

// ─── Component Props ─────────────────────────────────────────────

export interface OrderFormProps {
  pair: TradingPair;
  onSubmit: (order: {
    side: OrderSide;
    type: OrderType;
    price: number;
    amount: number;
  }) => void;
}

export interface ChartProps {
  pair: TradingPair;
  candles: CandleData[];
}
