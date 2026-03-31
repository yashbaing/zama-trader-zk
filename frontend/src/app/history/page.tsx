"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { formatUsd, formatTimestamp, shortenAddress } from "@/lib/utils";

type HistoryTab = "all" | "orders" | "trades" | "deposits";

// Demo history data
const DEMO_HISTORY = [
  { type: "trade", pair: "BTC/USDC", side: "BUY", status: "FILLED", time: Date.now() / 1000 - 3600, txHash: "0xabc...123" },
  { type: "deposit", token: "USDC", amount: 10000, status: "CONFIRMED", time: Date.now() / 1000 - 7200, txHash: "0xdef...456" },
  { type: "order", pair: "ETH/USDC", side: "SELL", orderType: "LIMIT", status: "CANCELLED", time: Date.now() / 1000 - 14400, txHash: "0xghi...789" },
  { type: "trade", pair: "SOL/USDC", side: "BUY", status: "FILLED", time: Date.now() / 1000 - 28800, txHash: "0xjkl...012" },
  { type: "deposit", token: "ETH", amount: 5, status: "CONFIRMED", time: Date.now() / 1000 - 43200, txHash: "0xmno...345" },
  { type: "trade", pair: "ETH/BTC", side: "SELL", status: "FILLED", time: Date.now() / 1000 - 57600, txHash: "0xpqr...678" },
  { type: "order", pair: "BTC/USDC", side: "BUY", orderType: "LIMIT", status: "OPEN", time: Date.now() / 1000 - 72000, txHash: "0xstu...901" },
  { type: "withdrawal", token: "USDC", amount: 2000, status: "PENDING", time: Date.now() / 1000 - 86400, txHash: "0xvwx...234" },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    FILLED: "bg-success/10 text-success border-success/20",
    CONFIRMED: "bg-success/10 text-success border-success/20",
    OPEN: "bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20",
    PENDING: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
    CANCELLED: "bg-text-muted/10 text-text-muted border-text-muted/20",
    PARTIALLY_FILLED: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
  };

  return (
    <span className={`inline-flex px-2 py-0.5 text-2xs font-medium rounded-full border ${styles[status] || styles.PENDING}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const icons: Record<string, string> = {
    trade: "⇌",
    order: "◈",
    deposit: "↓",
    withdrawal: "↑",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs">{icons[type] || "•"}</span>
      <span className="text-xs font-medium text-text-primary capitalize">{type}</span>
    </div>
  );
}

export default function HistoryPage() {
  const [tab, setTab] = useState<HistoryTab>("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const filteredHistory = tab === "all"
    ? DEMO_HISTORY
    : DEMO_HISTORY.filter((h) => {
        if (tab === "orders") return h.type === "order";
        if (tab === "trades") return h.type === "trade";
        if (tab === "deposits") return h.type === "deposit" || h.type === "withdrawal";
        return true;
      });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Transaction History</h1>
          <p className="text-sm text-text-secondary mt-1">View your on-chain activity — encrypted details visible only to you</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-bg-secondary/80 rounded-lg border border-border-subtle w-fit">
          {(["all", "orders", "trades", "deposits"] as HistoryTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
                tab === t
                  ? "bg-bg-elevated text-text-primary border border-border-medium"
                  : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* History Table */}
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-2xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Details</th>
                  <th className="text-left px-4 py-3 font-medium">Price / Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Time</th>
                  <th className="text-right px-4 py-3 font-medium">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredHistory.map((item, i) => (
                  <tr key={i} className="hover:bg-bg-hover/30 transition-colors">
                    <td className="px-4 py-3">
                      <TypeBadge type={item.type} />
                    </td>
                    <td className="px-4 py-3 text-xs text-text-primary">
                      {item.type === "trade" || item.type === "order" ? (
                        <span className="flex items-center gap-2">
                          {(item as any).pair}
                          <span className={`text-2xs font-semibold ${(item as any).side === "BUY" ? "text-success" : "text-danger"}`}>
                            {(item as any).side}
                          </span>
                        </span>
                      ) : (
                        <span>{(item as any).token}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.type === "deposit" || item.type === "withdrawal" ? (
                        <span className="text-xs font-mono text-text-primary">
                          {(item as any).amount?.toLocaleString()}
                        </span>
                      ) : (
                        <span className="encrypted-badge">
                          <svg width="6" height="6" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z"/></svg>
                          encrypted
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {formatTimestamp(item.time)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a href="#" className="text-2xs text-accent-cyan hover:underline font-mono">
                        {item.txHash}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredHistory.length === 0 && (
            <div className="text-center py-12">
              <p className="text-text-muted text-sm">No transactions found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
