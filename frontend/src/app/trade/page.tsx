"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Header from "@/components/layout/Header";
import { useWalletStore, useMarketStore, useTradingStore } from "@/store";
import { formatUsd, formatCrypto, formatPercent } from "@/lib/utils";
import { TRADING_PAIRS } from "@/lib/contracts";
import type { OrderSide, OrderType } from "@/types";

// ── Types ────────────────────────────────────────────────────────
type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w" | "1m_year";
type ChartType = "candlestick" | "line" | "area";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// ── Price Chart with Advanced Options ────────────────────────────
function PriceChart({ 
  pair, 
  timeframe,
  chartType,
  onTimeframeChange,
  onChartTypeChange
}: { 
  pair: { base: string; quote: string };
  timeframe: Timeframe;
  chartType: ChartType;
  onTimeframeChange: (tf: Timeframe) => void;
  onChartTypeChange: (ct: ChartType) => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const { prices } = useMarketStore();
  const priceData = prices.find((p) => p.symbol === pair.base);

  // Generate candle data based on timeframe
  const generateCandles = (): Candle[] => {
    const candleCount = timeframe === "1m_year" ? 365 : timeframe.includes("1m") ? 100 : 50;
    const intervalMap: Record<Timeframe, number> = {
      "1m": 60000,
      "5m": 300000,
      "15m": 900000,
      "1h": 3600000,
      "4h": 14400000,
      "1d": 86400000,
      "1w": 604800000,
      "1m_year": 2592000000, // 30 days
    };
    const interval = intervalMap[timeframe];
    
    const base = priceData?.price || 60000;
    const variance = base * 0.02;
    
    return Array.from({ length: candleCount }, (_, i) => {
      const open = base + (Math.random() - 0.5) * variance;
      const close = open + (Math.random() - 0.5) * variance * 0.8;
      return {
        time: Date.now() - (candleCount - i) * interval,
        open,
        high: Math.max(open, close) + Math.random() * variance * 0.3,
        low: Math.min(open, close) - Math.random() * variance * 0.3,
        close,
        volume: Math.random() * 1000000 + 100000,
      };
    });
  };

  const candles = generateCandles();
  const high = Math.max(...candles.map((c: Candle) => c.high));
  const low = Math.min(...candles.map((c: Candle) => c.low));
  const range = high - low || 1;

  // Format timeframe label
  const timeframeLabels: Record<Timeframe, string> = {
    "1m": "1 Min",
    "5m": "5 Min",
    "15m": "15 Min",
    "1h": "1 Hour",
    "4h": "4 Hour",
    "1d": "Daily",
    "1w": "Weekly",
    "1m_year": "Monthly (1Y)",
  };

  const renderChart = () => {
    if (chartType === "candlestick") {
      return (
        <svg ref={chartRef as any} viewBox="0 0 800 300" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(0,229,255,0.15)" />
              <stop offset="100%" stopColor="rgba(0,229,255,0)" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((pct) => (
            <line
              key={pct}
              x1="0" y1={pct * 280 + 10} x2="800" y2={pct * 280 + 10}
              stroke="rgba(90,106,138,0.1)" strokeDasharray="4 4"
            />
          ))}

          {/* Candlesticks */}
          {candles.map((c: Candle, i: number) => {
            const x = (i / candles.length) * 780 + 10;
            const width = Math.max(780 / candles.length * 0.7, 1);
            const isGreen = c.close >= c.open;
            const color = isGreen ? "#00e676" : "#ff5252";
            const bodyTop = 280 - ((Math.max(c.open, c.close) - low) / range) * 260 + 10;
            const bodyBottom = 280 - ((Math.min(c.open, c.close) - low) / range) * 260 + 10;
            const wickTop = 280 - ((c.high - low) / range) * 260 + 10;
            const wickBottom = 280 - ((c.low - low) / range) * 260 + 10;

            return (
              <g key={i}>
                <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={color} strokeWidth="1" opacity="0.6" />
                <rect
                  x={x - width / 2} y={bodyTop}
                  width={width} height={Math.max(bodyBottom - bodyTop, 1)}
                  fill={color} opacity="0.85" rx="1"
                />
              </g>
            );
          })}

          {/* Grid background */}
          <rect x="0" y="0" width="800" height="300" fill="transparent" opacity="0.3" />
        </svg>
      );
    } else if (chartType === "line") {
      return (
        <svg ref={chartRef as any} viewBox="0 0 800 300" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(0,229,255,0.25)" />
              <stop offset="100%" stopColor="rgba(0,229,255,0)" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((pct) => (
            <line key={pct} x1="0" y1={pct * 280 + 10} x2="800" y2={pct * 280 + 10} stroke="rgba(90,106,138,0.1)" strokeDasharray="4 4" />
          ))}

          {/* Line path */}
          <path
            d={`M ${candles.map((c: Candle, i: number) => `${(i / candles.length) * 780 + 10},${280 - ((c.close - low) / range) * 260 + 10}`).join(" L ")}`}
            stroke="#00e5ff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
          />

          {/* Area under line */}
          <path
            d={`M ${candles.map((c: Candle, i: number) => `${(i / candles.length) * 780 + 10},${280 - ((c.close - low) / range) * 260 + 10}`).join(" L ")} L 790,290 L 10,290 Z`}
            fill="url(#lineGrad)"
          />
        </svg>
      );
    } else {
      // Area chart
      return (
        <svg ref={chartRef as any} viewBox="0 0 800 300" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(76,175,80,0.4)" />
              <stop offset="100%" stopColor="rgba(76,175,80,0.05)" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((pct) => (
            <line key={pct} x1="0" y1={pct * 280 + 10} x2="800" y2={pct * 280 + 10} stroke="rgba(90,106,138,0.1)" strokeDasharray="4 4" />
          ))}

          {/* Area path */}
          <path
            d={`M ${candles.map((c: Candle, i: number) => `${(i / candles.length) * 780 + 10},${280 - ((c.close - low) / range) * 260 + 10}`).join(" L ")} L 790,290 L 10,290 Z`}
            fill="url(#areaGrad)" stroke="none"
          />
        </svg>
      );
    }
  };

  return (
    <div className="relative w-full h-96">
      {/* Chart Header */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 py-3 flex items-center justify-between bg-gradient-to-b from-bg-elevated/50 to-transparent border-b border-border-subtle">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display font-bold text-text-primary">
              {formatUsd(priceData?.price || 0)}
            </span>
            <span className={`text-sm font-mono ${(priceData?.change24h || 0) >= 0 ? "text-success" : "text-danger"}`}>
              {formatPercent(priceData?.change24h || 0)}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            H: {formatUsd(priceData?.high24h || 0)} · L: {formatUsd(priceData?.low24h || 0)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xs text-text-muted mb-1">Timeframe</p>
          <p className="text-sm font-semibold text-accent-cyan">{timeframeLabels[timeframe]}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-16 w-full h-64">
        {renderChart()}
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 right-4 text-2xs text-text-muted space-y-0.5">
        <div>📊 High: {formatUsd(high)}</div>
        <div>📉 Low: {formatUsd(low)}</div>
      </div>
    </div>
  );
}

// ── Order Form ───────────────────────────────────────────────────
function OrderForm({ pair }: { pair: { base: string; quote: string } }) {
  const [side, setSide] = useState<OrderSide>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const { isConnected } = useWalletStore();
  const { isPlacingOrder, placeOrder } = useTradingStore();
  const { prices } = useMarketStore();

  const currentPrice = prices.find((p) => p.symbol === pair.base)?.price || 0;
  const total = (parseFloat(price) || 0) * (parseFloat(amount) || 0);

  const handleSubmit = async () => {
    if (!price || !amount) return;
    try {
      await placeOrder({
        baseToken: pair.base,
        quoteToken: pair.quote,
        side,
        orderType,
        price: parseFloat(price),
        amount: parseFloat(amount),
      });
    } catch (e: any) {
      console.error("Order failed:", e.message);
    }
  };

  return (
    <div className="glass-panel h-full">
      <div className="px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">Place Order</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Buy / Sell Toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-bg-primary rounded-lg">
          {(["BUY", "SELL"] as OrderSide[]).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`py-2 rounded-md text-sm font-semibold transition-all ${
                side === s
                  ? s === "BUY"
                    ? "bg-success/15 text-success border border-success/20"
                    : "bg-danger/15 text-danger border border-danger/20"
                  : "text-text-muted border border-transparent hover:text-text-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Order Type */}
        <div className="flex gap-2">
          {(["LIMIT", "MARKET"] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                orderType === t
                  ? "bg-bg-elevated text-text-primary border border-border-medium"
                  : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Price Input */}
        {orderType === "LIMIT" && (
          <div>
            <label className="text-2xs uppercase tracking-widest text-text-muted font-medium mb-1.5 block">
              Price ({pair.quote})
            </label>
            <div className="relative">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={currentPrice.toFixed(2)}
                className="input-field pr-16 font-mono"
                step="0.01"
              />
              <button
                onClick={() => setPrice(currentPrice.toFixed(2))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-accent-cyan hover:text-accent-cyan/80 font-medium"
              >
                Market
              </button>
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div>
          <label className="text-2xs uppercase tracking-widest text-text-muted font-medium mb-1.5 block">
            Amount ({pair.base})
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input-field font-mono"
            step="0.001"
          />
          <div className="flex gap-2 mt-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                className="flex-1 py-1 text-2xs text-text-muted bg-bg-primary rounded hover:text-text-secondary hover:bg-bg-hover transition-colors"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Encryption Notice */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-violet/5 border border-accent-violet/15">
          <svg width="12" height="12" viewBox="0 0 8 8" fill="currentColor" className="text-accent-violet shrink-0">
            <path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z"/>
          </svg>
          <span className="text-2xs text-accent-violet">
            Price & amount will be encrypted with FHE before submission
          </span>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between py-2 border-t border-border-subtle">
          <span className="text-xs text-text-muted">Total</span>
          <span className="text-sm font-mono text-text-primary">
            {total > 0 ? formatUsd(total) : "—"} {pair.quote}
          </span>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isConnected || isPlacingOrder || !amount}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
            side === "BUY"
              ? "bg-success/15 text-success border border-success/25 hover:bg-success/25"
              : "bg-danger/15 text-danger border border-danger/25 hover:bg-danger/25"
          }`}
        >
          {isPlacingOrder ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4" strokeDashoffset="10" /></svg>
              Encrypting & Submitting...
            </span>
          ) : !isConnected ? (
            "Connect Wallet"
          ) : (
            `${side} ${pair.base}`
          )}
        </button>
      </div>
    </div>
  );
}

// ── Order Book Display ───────────────────────────────────────────
function OrderBookDisplay({ pair }: { pair: { base: string; quote: string } }) {
  const { prices } = useMarketStore();
  const currentPrice = prices.find((p) => p.symbol === pair.base)?.price || 60000;

  // Generate demo encrypted order book entries
  const asks = Array.from({ length: 8 }, (_, i) => ({
    price: currentPrice * (1 + (i + 1) * 0.001),
    amount: Math.random() * 2 + 0.1,
    total: 0,
    encrypted: true,
  })).reverse();

  const bids = Array.from({ length: 8 }, (_, i) => ({
    price: currentPrice * (1 - (i + 1) * 0.001),
    amount: Math.random() * 2 + 0.1,
    total: 0,
    encrypted: true,
  }));

  return (
    <div className="glass-panel h-full">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Order Book</h2>
        <span className="encrypted-badge">
          <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z"/></svg>
          Encrypted
        </span>
      </div>
      <div className="px-4 py-2">
        {/* Header */}
        <div className="flex justify-between text-2xs text-text-muted uppercase tracking-wider mb-2">
          <span>Price ({pair.quote})</span>
          <span>Amount ({pair.base})</span>
        </div>

        {/* Asks (sell orders) */}
        <div className="space-y-0.5">
          {asks.map((order, i) => (
            <div key={`ask-${i}`} className="flex justify-between py-0.5 text-xs font-mono relative">
              <div className="absolute inset-0 bg-danger/5 rounded-sm" style={{ width: `${(order.amount / 2.5) * 100}%`, right: 0, left: "auto" }} />
              <span className="text-danger relative z-10">{order.price.toFixed(2)}</span>
              <span className="text-text-secondary relative z-10">{order.amount.toFixed(4)}</span>
            </div>
          ))}
        </div>

        {/* Spread / Current Price */}
        <div className="py-2 my-1 border-y border-border-subtle text-center">
          <span className="text-sm font-semibold text-accent-cyan font-mono">{formatUsd(currentPrice)}</span>
        </div>

        {/* Bids (buy orders) */}
        <div className="space-y-0.5">
          {bids.map((order, i) => (
            <div key={`bid-${i}`} className="flex justify-between py-0.5 text-xs font-mono relative">
              <div className="absolute inset-0 bg-success/5 rounded-sm" style={{ width: `${(order.amount / 2.5) * 100}%`, right: 0, left: "auto" }} />
              <span className="text-success relative z-10">{order.price.toFixed(2)}</span>
              <span className="text-text-secondary relative z-10">{order.amount.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Recent Trades ────────────────────────────────────────────────
function RecentTrades({ pair }: { pair: { base: string; quote: string } }) {
  const { prices } = useMarketStore();
  const currentPrice = prices.find((p) => p.symbol === pair.base)?.price || 60000;

  const demoTrades = Array.from({ length: 15 }, (_, i) => ({
    price: currentPrice + (Math.random() - 0.5) * currentPrice * 0.005,
    amount: Math.random() * 0.5 + 0.01,
    side: Math.random() > 0.5 ? "BUY" : "SELL",
    time: new Date(Date.now() - i * 45000).toLocaleTimeString("en-US", { hour12: false }),
  }));

  return (
    <div className="glass-panel">
      <div className="px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">Recent Trades</h2>
      </div>
      <div className="px-4 py-2">
        <div className="flex justify-between text-2xs text-text-muted uppercase tracking-wider mb-2">
          <span>Price</span>
          <span>Amount</span>
          <span>Time</span>
        </div>
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {demoTrades.map((t, i) => (
            <div key={i} className="flex justify-between text-xs font-mono py-0.5">
              <span className={t.side === "BUY" ? "text-success" : "text-danger"}>
                {t.price.toFixed(2)}
              </span>
              <span className="text-text-secondary">{t.amount.toFixed(4)}</span>
              <span className="text-text-muted">{t.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Open Orders ──────────────────────────────────────────────────
function OpenOrders() {
  const demoOrders = [
    { id: 1, pair: "BTC/USDC", side: "BUY" as const, type: "LIMIT", status: "OPEN", time: "2 min ago" },
    { id: 2, pair: "ETH/USDC", side: "SELL" as const, type: "LIMIT", status: "PARTIALLY_FILLED", time: "15 min ago" },
    { id: 3, pair: "SOL/USDC", side: "BUY" as const, type: "MARKET", status: "OPEN", time: "1 hr ago" },
  ];

  return (
    <div className="glass-panel">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Open Orders</h2>
        <span className="text-2xs text-text-muted">{demoOrders.length} active</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-2xs text-text-muted uppercase tracking-wider">
              <th className="text-left px-4 py-2 font-medium">Pair</th>
              <th className="text-left px-4 py-2 font-medium">Side</th>
              <th className="text-left px-4 py-2 font-medium">Type</th>
              <th className="text-left px-4 py-2 font-medium">Price</th>
              <th className="text-left px-4 py-2 font-medium">Amount</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/50">
            {demoOrders.map((order) => (
              <tr key={order.id} className="hover:bg-bg-hover/30 transition-colors">
                <td className="px-4 py-2.5 text-xs font-medium text-text-primary">{order.pair}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-semibold ${order.side === "BUY" ? "text-success" : "text-danger"}`}>
                    {order.side}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-text-secondary">{order.type}</td>
                <td className="px-4 py-2.5">
                  <span className="encrypted-badge">
                    <svg width="6" height="6" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z"/></svg>
                    encrypted
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="encrypted-badge">
                    <svg width="6" height="6" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z"/></svg>
                    encrypted
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-2xs px-2 py-0.5 rounded-full ${
                    order.status === "OPEN" ? "bg-accent-cyan/10 text-accent-cyan" : "bg-accent-amber/10 text-accent-amber"
                  }`}>
                    {order.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button className="text-2xs text-danger hover:text-danger/80 font-medium">Cancel</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Trade Page ──────────────────────────────────────────────
export default function TradePage() {
  const { selectedPair, fetchPrices, setSelectedPair } = useMarketStore();
  const [mounted, setMounted] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [chartType, setChartType] = useState<ChartType>("candlestick");

  useEffect(() => {
    setMounted(true);
    fetchPrices();
    const interval = setInterval(fetchPrices, 15000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  if (!mounted) return null;

  const timeframes: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1m_year"];
  const chartTypes: ChartType[] = ["candlestick", "line", "area"];

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 space-y-4">
        {/* Pair Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {TRADING_PAIRS.map((p) => (
            <button
              key={p.label}
              onClick={() => setSelectedPair(p.base, p.quote)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                selectedPair.base === p.base && selectedPair.quote === p.quote
                  ? "bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20"
                  : "text-text-secondary hover:text-text-primary border border-transparent hover:border-border-subtle"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Chart */}
          <div className="lg:col-span-7 glass-panel overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-primary">
                  {selectedPair.base}/{selectedPair.quote}
                </h2>
                <div className="flex items-center gap-2">
                  {/* Chart Type Selector */}
                  <div className="flex gap-1 bg-bg-primary rounded-lg p-1">
                    {chartTypes.map((ct) => (
                      <button
                        key={ct}
                        onClick={() => setChartType(ct)}
                        title={ct.charAt(0).toUpperCase() + ct.slice(1)}
                        className={`w-8 h-8 rounded flex items-center justify-center text-xs font-semibold transition-all ${
                          chartType === ct
                            ? "bg-accent-cyan text-bg-elevated"
                            : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
                        }`}
                      >
                        {ct === "candlestick" ? "📊" : ct === "line" ? "📈" : "📉"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Timeframe Selector */}
              <div className="flex gap-1 flex-wrap">
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      timeframe === tf
                        ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30"
                        : "text-text-muted hover:text-text-secondary border border-transparent hover:bg-bg-hover"
                    }`}
                  >
                    {tf === "1m_year" ? "1Y" : tf.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <PriceChart 
              pair={selectedPair}
              timeframe={timeframe}
              chartType={chartType}
              onTimeframeChange={setTimeframe}
              onChartTypeChange={setChartType}
            />
          </div>

          {/* Order Book */}
          <div className="lg:col-span-2">
            <OrderBookDisplay pair={selectedPair} />
          </div>

          {/* Order Form */}
          <div className="lg:col-span-3">
            <OrderForm pair={selectedPair} />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <OpenOrders />
          </div>
          <div>
            <RecentTrades pair={selectedPair} />
          </div>
        </div>
      </main>
    </div>
  );
}
