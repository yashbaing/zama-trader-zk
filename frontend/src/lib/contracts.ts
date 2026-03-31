/**
 * Contract addresses and ABIs for the ZKTrader protocol.
 * Update addresses after deployment.
 */

export const CHAIN_CONFIG = {
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "8009"),
  chainName: "Zama fhEVM Devnet",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://devnet.zama.ai",
  blockExplorer: "https://main.explorer.zama.ai",
  nativeCurrency: {
    name: "ZAMA",
    symbol: "ZAMA",
    decimals: 18,
  },
};

export const CONTRACTS = {
  vault: process.env.NEXT_PUBLIC_VAULT_ADDRESS || "",
  orderBook: process.env.NEXT_PUBLIC_ORDER_BOOK_ADDRESS || "",
  tradingEngine: process.env.NEXT_PUBLIC_TRADING_ENGINE_ADDRESS || "",
  autoInvestVault: process.env.NEXT_PUBLIC_AUTO_INVEST_VAULT_ADDRESS || "",
};

export const TOKENS: Record<string, { address: string; symbol: string; name: string; decimals: number; icon: string }> = {
  BTC: {
    address: process.env.NEXT_PUBLIC_WBTC_ADDRESS || "",
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    icon: "₿",
  },
  ETH: {
    address: process.env.NEXT_PUBLIC_WETH_ADDRESS || "",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    icon: "Ξ",
  },
  SOL: {
    address: process.env.NEXT_PUBLIC_WSOL_ADDRESS || "",
    symbol: "WSOL",
    name: "Wrapped Solana",
    decimals: 9,
    icon: "◎",
  },
  USDC: {
    address: process.env.NEXT_PUBLIC_USDC_ADDRESS || "",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    icon: "$",
  },
};

export const TRADING_PAIRS = [
  { base: "BTC", quote: "USDC", label: "BTC/USDC" },
  { base: "ETH", quote: "USDC", label: "ETH/USDC" },
  { base: "SOL", quote: "USDC", label: "SOL/USDC" },
  { base: "ETH", quote: "BTC", label: "ETH/BTC" },
];

// ── Vault ABI (subset for frontend interactions) ──────────────────
export const VAULT_ABI = [
  "function deposit(address token, uint256 amount) external",
  "function requestWithdrawal(address token, bytes32 encryptedAmount, bytes calldata inputProof) external returns (uint256)",
  "function getEncryptedBalance(address token, bytes32 publicKey, bytes calldata signature) external view returns (bytes memory)",
  "function supportedTokens(address) external view returns (bool)",
  "event Deposited(address indexed user, address indexed token, uint256 amount)",
  "event WithdrawalRequested(uint256 indexed requestId, address indexed user, address indexed token)",
  "event WithdrawalFulfilled(uint256 indexed requestId, address indexed user, uint256 amount)",
];

// ── OrderBook ABI ─────────────────────────────────────────────────
export const ORDER_BOOK_ABI = [
  "function placeOrder(address baseToken, address quoteToken, uint8 side, uint8 orderType, bytes32 encryptedPrice, bytes32 encryptedAmount, bytes calldata inputProof) external returns (uint256)",
  "function cancelOrder(uint256 orderId) external",
  "function getOrderMetadata(uint256 orderId) external view returns (address trader, address baseToken, address quoteToken, uint8 side, uint8 orderType, uint8 status, uint256 timestamp)",
  "function getMyOrderDetails(uint256 orderId, bytes32 publicKey, bytes calldata signature) external view returns (bytes memory encPrice, bytes memory encAmount, bytes memory encFilled)",
  "function getUserOrders(address user) external view returns (uint256[] memory)",
  "function getBuyOrders(address baseToken, address quoteToken) external view returns (uint256[] memory)",
  "function getSellOrders(address baseToken, address quoteToken) external view returns (uint256[] memory)",
  "function nextOrderId() external view returns (uint256)",
  "event OrderPlaced(uint256 indexed orderId, address indexed trader, address baseToken, address quoteToken, uint8 side, uint8 orderType, uint256 timestamp)",
  "event OrderCancelled(uint256 indexed orderId, address indexed trader)",
];

// ── ERC20 ABI (for token approvals and faucet) ───────────────────
export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function faucet() external",
];
