import { Router, Request, Response } from "express";
import { fetchPrices, getPrice } from "../services/priceService.js";
import { getOrders, getTrades, getDeposits, getTradeCount, getOrderCount } from "../services/eventIndexer.js";
import { config, TOKEN_META } from "../../config/index.js";

import { fetchFearGreedIndex, fetchFearGreedHistory } from "../services/fearGreedService.js";

const router = Router();

// ─── Health Check ────────────────────────────────────────────────
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    chain: config.chainId,
  });
});

// ─── Market Prices (PUBLIC data) ─────────────────────────────────
router.get("/prices", async (_req: Request, res: Response) => {
  try {
    const prices = await fetchPrices();
    res.json({ prices });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

router.get("/prices/:symbol", async (req: Request, res: Response) => {
  try {
    const price = await getPrice(req.params.symbol.toUpperCase());
    if (!price) {
      res.status(404).json({ error: "Token not found" });
      return;
    }
    res.json(price);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch price" });
  }
});

// ─── Orders (PUBLIC metadata only — no encrypted values) ─────────
router.get("/orders", (req: Request, res: Response) => {
  const { trader, status } = req.query;
  const orders = getOrders({
    trader: trader as string,
    status: status as string,
  });
  res.json({ orders, total: orders.length });
});

// ─── Trades (PUBLIC metadata only) ──────────────────────────────
router.get("/trades", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const trades = getTrades(limit);
  res.json({ trades, total: trades.length });
});

// ─── Deposits (PUBLIC — deposit amounts are visible on-chain) ────
router.get("/deposits", (req: Request, res: Response) => {
  const { user } = req.query;
  const deposits = getDeposits(user as string);
  res.json({ deposits, total: deposits.length });
});

// ─── Protocol Statistics ─────────────────────────────────────────
router.get("/stats", async (_req: Request, res: Response) => {
  const prices = await fetchPrices();
  res.json({
    totalTrades: getTradeCount(),
    totalOrders: getOrderCount(),
    supportedTokens: Object.keys(TOKEN_META).length,
    tradingPairs: 4,
    prices: prices.length,
    chain: "Zama fhEVM Devnet",
    chainId: config.chainId,
  });
});

// ─── Contract Addresses (for frontend config) ────────────────────
router.get("/contracts", (_req: Request, res: Response) => {
  res.json({
    vault: config.contracts.vault,
    orderBook: config.contracts.orderBook,
    tradingEngine: config.contracts.tradingEngine,
    autoInvestVault: config.contracts.autoInvestVault,
    tokens: config.tokens,
  });
});

// ─── Token Metadata ──────────────────────────────────────────────
router.get("/tokens", (_req: Request, res: Response) => {
  const tokens = Object.entries(TOKEN_META).map(([key, meta]) => ({
    key,
    ...meta,
    address: config.tokens[key.toLowerCase() as keyof typeof config.tokens] || "",
  }));
  res.json({ tokens });
});

// ─── Fear & Greed Index ──────────────────────────────────────────
router.get("/fear-greed", async (_req: Request, res: Response) => {
  try {
    const data = await fetchFearGreedIndex();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch Fear & Greed Index" });
  }
});

router.get("/fear-greed/history", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const history = await fetchFearGreedHistory(days);
    res.json({ history, days });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
