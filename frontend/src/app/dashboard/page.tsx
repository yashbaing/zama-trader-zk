"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { useWalletStore, useMarketStore, useVaultStore } from "@/store";
import { formatUsd, formatCrypto, formatPercent } from "@/lib/utils";

// ── Stat Card Component ──────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="stat-card group">
      <p className="text-2xs uppercase tracking-widest text-text-muted font-medium mb-2">{label}</p>
      <p className={`text-xl font-display font-semibold ${accent || "text-text-primary"}`}>{value}</p>
      {sub && <p className="text-xs text-text-secondary mt-1">{sub}</p>}
    </div>
  );
}

// ── Token Row Component ──────────────────────────────────────────
function TokenRow({ symbol, icon, price, change, balance, usdValue }: {
  symbol: string; icon: string; price: number; change: number; balance: number; usdValue: number;
}) {
  const isPositive = change >= 0;
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-bg-hover/50 transition-colors group">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center text-lg border border-border-subtle group-hover:border-border-medium transition-colors">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{symbol}</p>
          <p className="text-xs text-text-muted font-mono">{formatUsd(price)}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-2">
          <span className="encrypted-badge">
            <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z"/></svg>
            enc
          </span>
          <p className="text-sm font-mono text-text-primary">{formatCrypto(balance)}</p>
        </div>
        <div className="flex items-center justify-end gap-2 mt-0.5">
          <span className="text-xs text-text-muted">{formatUsd(usdValue)}</span>
          <span className={`text-2xs font-mono ${isPositive ? "text-success" : "text-danger"}`}>
            {formatPercent(change)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Privacy Shield Visual ────────────────────────────────────────
function PrivacyShield() {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-violet/10 flex items-center justify-center border border-accent-violet/20 shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-violet">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-1">Privacy Shield Active</h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Your portfolio balances are stored as encrypted ciphertexts using Zama&apos;s Fully Homomorphic Encryption.
            Only you can decrypt and view your balances — not even the protocol can read them.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {["Balances Encrypted", "Orders Hidden", "Strategy Private"].map((tag) => (
              <span key={tag} className="px-2 py-0.5 text-2xs bg-accent-violet/5 text-accent-violet border border-accent-violet/15 rounded-md">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard Page ──────────────────────────────────────────
export default function DashboardPage() {
  const { isConnected } = useWalletStore();
  const { prices, fetchPrices } = useMarketStore();
  const { balances } = useVaultStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  if (!mounted) return null;

  // Demo balances for unconnected state
  const demoBalances = [
    { symbol: "BTC", icon: "₿", balance: 0.45, usdValue: 30344.48 },
    { symbol: "ETH", icon: "Ξ", balance: 12.8, usdValue: 45074.18 },
    { symbol: "SOL", icon: "◎", balance: 250, usdValue: 35667.5 },
    { symbol: "USDC", icon: "$", balance: 15000, usdValue: 15000 },
  ];

  const totalPortfolio = demoBalances.reduce((sum, b) => sum + b.usdValue, 0);
  const totalPnl = 4231.67;
  const pnlPercent = (totalPnl / (totalPortfolio - totalPnl)) * 100;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">
            {isConnected ? "Your encrypted portfolio overview" : "Connect wallet to view your encrypted portfolio"}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Portfolio Value"
            value={formatUsd(totalPortfolio)}
            sub="Decrypted locally"
            accent="text-text-primary"
          />
          <StatCard
            label="24h PnL"
            value={`${totalPnl >= 0 ? "+" : ""}${formatUsd(totalPnl)}`}
            sub={formatPercent(pnlPercent)}
            accent={totalPnl >= 0 ? "text-success" : "text-danger"}
          />
          <StatCard
            label="Open Orders"
            value="3"
            sub="All encrypted"
            accent="text-accent-cyan"
          />
          <StatCard
            label="Total Trades"
            value="47"
            sub="Settled on-chain"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Holdings */}
          <div className="lg:col-span-2 glass-panel">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Holdings</h2>
              <span className="encrypted-badge">
                <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z"/></svg>
                FHE Encrypted
              </span>
            </div>
            <div className="divide-y divide-border-subtle/50">
              {demoBalances.map((b) => {
                const priceData = prices.find((p) => p.symbol === b.symbol);
                return (
                  <TokenRow
                    key={b.symbol}
                    symbol={b.symbol}
                    icon={b.icon}
                    price={priceData?.price || 0}
                    change={priceData?.change24h || 0}
                    balance={b.balance}
                    usdValue={b.usdValue}
                  />
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <PrivacyShield />

            {/* Market Overview */}
            <div className="glass-panel">
              <div className="px-4 py-3 border-b border-border-subtle">
                <h2 className="text-sm font-semibold text-text-primary">Market Prices</h2>
              </div>
              <div className="p-3 space-y-2">
                {prices.filter(p => p.symbol !== "USDC").map((p) => (
                  <div key={p.symbol} className="flex items-center justify-between py-1.5">
                    <span className="text-xs font-medium text-text-secondary">{p.symbol}/USD</span>
                    <div className="text-right">
                      <span className="text-xs font-mono text-text-primary">{formatUsd(p.price)}</span>
                      <span className={`text-2xs font-mono ml-2 ${p.change24h >= 0 ? "text-success" : "text-danger"}`}>
                        {formatPercent(p.change24h)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-panel p-4">
              <h3 className="text-xs uppercase tracking-widest text-text-muted font-medium mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <a href="/trade" className="btn-primary text-center text-xs py-2">Trade</a>
                <a href="/vault" className="btn-primary text-center text-xs py-2">Deposit</a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
