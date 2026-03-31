import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  nodeEnv: process.env.NODE_ENV || "development",
  rpcUrl: process.env.ZAMA_RPC_URL || "https://devnet.zama.ai",
  chainId: parseInt(process.env.CHAIN_ID || "8009"),

  contracts: {
    vault: process.env.VAULT_ADDRESS || "",
    orderBook: process.env.ORDER_BOOK_ADDRESS || "",
    tradingEngine: process.env.TRADING_ENGINE_ADDRESS || "",
    autoInvestVault: process.env.AUTO_INVEST_VAULT_ADDRESS || "",
  },

  tokens: {
    wbtc: process.env.WBTC_ADDRESS || "",
    weth: process.env.WETH_ADDRESS || "",
    wsol: process.env.WSOL_ADDRESS || "",
    usdc: process.env.USDC_ADDRESS || "",
  },

  priceApiUrl: process.env.PRICE_API_URL || "https://api.coingecko.com/api/v3",
  relayerKey: process.env.RELAYER_PRIVATE_KEY || "",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
} as const;

// Token metadata (public info — no privacy concern)
export const TOKEN_META = {
  BTC: { symbol: "WBTC", decimals: 8, coingeckoId: "bitcoin", icon: "₿" },
  ETH: { symbol: "WETH", decimals: 18, coingeckoId: "ethereum", icon: "Ξ" },
  SOL: { symbol: "WSOL", decimals: 9, coingeckoId: "solana", icon: "◎" },
  USDC: { symbol: "USDC", decimals: 6, coingeckoId: "usd-coin", icon: "$" },
} as const;
