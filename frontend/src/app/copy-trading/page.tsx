"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { useWalletStore } from "@/store";

// Demo leader data
const DEMO_LEADERS = [
  {
    address: "0x7a2F...c4E9",
    name: "CryptoWhale",
    followers: 234,
    return30d: 18.7,
    maxDrawdown: -8.2,
    aum: 2_450_000,
    tokens: ["BTC", "ETH", "SOL"],
    active: true,
    riskLevel: "Medium",
  },
  {
    address: "0x3bC1...aF82",
    name: "DeFiAlpha",
    followers: 156,
    return30d: 32.1,
    maxDrawdown: -15.4,
    aum: 890_000,
    tokens: ["ETH", "SOL"],
    active: true,
    riskLevel: "High",
  },
  {
    address: "0x9dE4...b127",
    name: "SteadyEddie",
    followers: 512,
    return30d: 6.3,
    maxDrawdown: -2.1,
    aum: 5_200_000,
    tokens: ["BTC", "USDC"],
    active: true,
    riskLevel: "Low",
  },
  {
    address: "0x1fA7...d953",
    name: "MomentumTrader",
    followers: 89,
    return30d: -4.2,
    maxDrawdown: -22.5,
    aum: 340_000,
    tokens: ["SOL", "ETH", "BTC"],
    active: true,
    riskLevel: "Very High",
  },
];

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    Low: { bg: "rgba(0,230,118,0.06)", text: "#00e676", border: "rgba(0,230,118,0.15)" },
    Medium: { bg: "rgba(255,215,64,0.06)", text: "#ffd740", border: "rgba(255,215,64,0.15)" },
    High: { bg: "rgba(255,152,0,0.06)", text: "#ff9800", border: "rgba(255,152,0,0.15)" },
    "Very High": { bg: "rgba(255,82,82,0.06)", text: "#ff5252", border: "rgba(255,82,82,0.15)" },
  };
  const c = colors[level] || colors.Medium;
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 10,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      {level} Risk
    </span>
  );
}

function LeaderCard({ leader, onFollow }: { leader: typeof DEMO_LEADERS[0]; onFollow: () => void }) {
  return (
    <div style={{
      background: "rgba(12,16,24,0.7)", border: "1px solid rgba(26,34,54,0.7)",
      borderRadius: 12, padding: 16, transition: "border-color 0.2s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{leader.name}</p>
          <p style={{ fontSize: 11, color: "#5a6a8a", fontFamily: "monospace" }}>{leader.address}</p>
        </div>
        <RiskBadge level={leader.riskLevel} />
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#5a6a8a", marginBottom: 3 }}>30d Return</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: leader.return30d >= 0 ? "#00e676" : "#ff5252", fontFamily: "monospace" }}>
            {leader.return30d >= 0 ? "+" : ""}{leader.return30d}%
          </p>
        </div>
        <div>
          <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#5a6a8a", marginBottom: 3 }}>Max DD</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#ff5252", fontFamily: "monospace" }}>{leader.maxDrawdown}%</p>
        </div>
        <div>
          <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#5a6a8a", marginBottom: 3 }}>Followers</p>
          <p style={{ fontSize: 16, fontWeight: 600, fontFamily: "monospace" }}>{leader.followers}</p>
        </div>
      </div>

      {/* Tokens */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {leader.tokens.map(t => (
          <span key={t} style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 6,
            background: "rgba(18,24,36,0.8)", border: "1px solid rgba(26,34,54,0.6)",
            color: "#8898b5",
          }}>
            {t}
          </span>
        ))}
      </div>

      {/* Privacy notice */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5, padding: "5px 8px",
        borderRadius: 6, background: "rgba(179,136,255,0.04)", border: "1px solid rgba(179,136,255,0.12)",
        marginBottom: 12,
      }}>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="#b388ff">
          <path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z"/>
        </svg>
        <span style={{ fontSize: 9.5, color: "#b388ff" }}>
          Allocation strategy encrypted — you copy results, not details
        </span>
      </div>

      {/* AUM + Follow */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#5a6a8a" }}>
          AUM: ${(leader.aum / 1_000_000).toFixed(1)}M
        </span>
        <button onClick={onFollow} style={{
          padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
          background: "rgba(0,229,255,0.08)", color: "#00e5ff",
          border: "1px solid rgba(0,229,255,0.18)",
        }}>
          Follow
        </button>
      </div>
    </div>
  );
}

export default function CopyTradingPage() {
  const { isConnected } = useWalletStore();
  const [sortBy, setSortBy] = useState<"return" | "followers" | "drawdown">("return");

  const sorted = [...DEMO_LEADERS].sort((a, b) => {
    if (sortBy === "return") return b.return30d - a.return30d;
    if (sortBy === "followers") return b.followers - a.followers;
    return b.maxDrawdown - a.maxDrawdown; // Less negative = better
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Copy Trading</h1>
          <p className="text-sm text-text-secondary mt-1">
            Follow top traders — their strategies are encrypted, you copy their performance
          </p>
        </div>

        {/* Info banner */}
        <div className="glass-panel p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-cyan/10 flex items-center justify-center border border-accent-cyan/20 shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-cyan">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <path d="M20 8v6M23 11h-6"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">How it works</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Leaders set encrypted allocation strategies on-chain. When you follow a leader,
                your funds are automatically allocated using their encrypted percentages — but you
                never see their actual strategy. The FHE coprocessor executes the copy without
                revealing any details to anyone.
              </p>
            </div>
          </div>
        </div>

        {/* Sort controls */}
        <div className="flex gap-2">
          <span className="text-xs text-text-muted self-center mr-1">Sort by:</span>
          {[
            { key: "return" as const, label: "30d Return" },
            { key: "followers" as const, label: "Followers" },
            { key: "drawdown" as const, label: "Lowest DD" },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                sortBy === s.key
                  ? "bg-bg-elevated text-text-primary border border-border-medium"
                  : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Leader Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((leader) => (
            <LeaderCard
              key={leader.address}
              leader={leader}
              onFollow={() => {
                if (!isConnected) {
                  alert("Connect your wallet first");
                  return;
                }
                alert(`Following ${leader.name} — in production, this calls CopyTrading.follow()`);
              }}
            />
          ))}
        </div>

        {/* Become a leader CTA */}
        <div className="glass-panel p-6 text-center">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Become a Leader</h3>
          <p className="text-sm text-text-secondary mb-4 max-w-md mx-auto">
            Share your encrypted trading strategy and earn a share of follower profits.
            Your actual allocations remain private — only performance is visible.
          </p>
          <button className="btn-primary" disabled={!isConnected}>
            Register as Leader
          </button>
        </div>
      </main>
    </div>
  );
}
