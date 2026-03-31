"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { useWalletStore, useMarketStore, useVaultStore } from "@/store";
import { formatUsd, formatCrypto, formatPercent } from "@/lib/utils";
import { TOKENS } from "@/lib/contracts";

// ── Deposit / Withdraw Form ──────────────────────────────────────
function VaultForm() {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [selectedToken, setSelectedToken] = useState("USDC");
  const [amount, setAmount] = useState("");
  const { isConnected } = useWalletStore();
  const { depositing, deposit } = useVaultStore();

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    try {
      const txHash = await deposit(selectedToken, parseFloat(amount));
      console.log("Deposit tx:", txHash);
      setAmount("");
    } catch (e: any) {
      console.error("Deposit failed:", e.message);
    }
  };

  return (
    <div className="glass-panel">
      <div className="px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">
          {mode === "deposit" ? "Deposit to Vault" : "Withdraw from Vault"}
        </h2>
      </div>
      <div className="p-4 space-y-4">
        {/* Mode Toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-bg-primary rounded-lg">
          {(["deposit", "withdraw"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`py-2 rounded-md text-sm font-semibold capitalize transition-all ${
                mode === m
                  ? "bg-bg-elevated text-text-primary border border-border-medium"
                  : "text-text-muted border border-transparent"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Token Select */}
        <div>
          <label className="text-2xs uppercase tracking-widest text-text-muted font-medium mb-1.5 block">Token</label>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(TOKENS).map(([key, token]) => (
              <button
                key={key}
                onClick={() => setSelectedToken(key)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  selectedToken === key
                    ? "bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20"
                    : "bg-bg-primary text-text-secondary border border-border-subtle hover:border-border-medium"
                }`}
              >
                <span className="text-base">{token.icon}</span>
                <span>{key}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="text-2xs uppercase tracking-widest text-text-muted font-medium mb-1.5 block">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input-field font-mono text-lg"
            step="0.01"
          />
        </div>

        {/* Info Box */}
        {mode === "deposit" && (
          <div className="px-3 py-2.5 rounded-lg bg-accent-emerald/5 border border-accent-emerald/15">
            <p className="text-2xs text-accent-emerald">
              Your deposit amount is visible during the transaction. Once stored in the vault,
              your balance is encrypted with FHE and becomes invisible to everyone except you.
            </p>
          </div>
        )}

        {mode === "withdraw" && (
          <div className="px-3 py-2.5 rounded-lg bg-accent-violet/5 border border-accent-violet/15">
            <p className="text-2xs text-accent-violet">
              Withdrawal amount will be encrypted before submission.
              The amount is only revealed when the Gateway processes the transfer.
            </p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isConnected || depositing || !amount}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
            mode === "deposit"
              ? "bg-success/15 text-success border border-success/25 hover:bg-success/25"
              : "bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/25 hover:bg-accent-cyan/25"
          }`}
        >
          {depositing ? "Processing..." : !isConnected ? "Connect Wallet" : mode === "deposit" ? "Deposit" : "Withdraw"}
        </button>
      </div>
    </div>
  );
}

// ── Vault Balances Table ─────────────────────────────────────────
function VaultBalances() {
  const { prices } = useMarketStore();

  const balances = [
    { key: "BTC", icon: "₿", balance: 0.45, change: 2.34 },
    { key: "ETH", icon: "Ξ", balance: 12.8, change: -0.87 },
    { key: "SOL", icon: "◎", balance: 250, change: 5.12 },
    { key: "USDC", icon: "$", balance: 15000, change: 0.01 },
  ];

  return (
    <div className="glass-panel">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Vault Balances</h2>
        <span className="encrypted-badge">
          <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z"/></svg>
          Decrypted Locally
        </span>
      </div>
      <div className="divide-y divide-border-subtle/50">
        {balances.map((b) => {
          const priceData = prices.find((p) => p.symbol === b.key);
          const usdValue = b.balance * (priceData?.price || 0);
          return (
            <div key={b.key} className="flex items-center justify-between px-4 py-3 hover:bg-bg-hover/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center text-lg border border-border-subtle">
                  {b.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{b.key}</p>
                  <p className="text-xs text-text-muted">{TOKENS[b.key]?.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-text-primary">{formatCrypto(b.balance)}</p>
                <p className="text-xs text-text-muted">{formatUsd(usdValue)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Auto-Invest Strategy Panel ───────────────────────────────────
function AutoInvestPanel() {
  const sentiments = [
    { label: "Extreme Fear", value: 15, color: "text-danger" },
    { label: "Fear", value: 30, color: "text-accent-amber" },
    { label: "Neutral", value: 50, color: "text-text-secondary" },
    { label: "Greed", value: 70, color: "text-accent-emerald" },
    { label: "Extreme Greed", value: 85, color: "text-success" },
  ];

  const currentIndex = 28; // Demo: Fear

  return (
    <div className="glass-panel">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Auto-Invest</h2>
        <span className="text-2xs px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
          Fear & Greed: {currentIndex}
        </span>
      </div>
      <div className="p-4 space-y-4">
        {/* Fear & Greed Gauge */}
        <div className="relative h-3 bg-bg-primary rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${currentIndex}%`,
              background: "linear-gradient(90deg, #ff5252, #ffd740, #00e676)",
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-bg-primary shadow-lg"
            style={{ left: `${currentIndex}%`, transform: "translate(-50%, -50%)" }}
          />
        </div>

        <p className="text-xs text-text-secondary">
          Set encrypted allocation percentages for each sentiment level.
          Your strategy is stored encrypted — no one can see your allocation plan.
        </p>

        {/* Strategy Matrix */}
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-1 text-center">
            {sentiments.map((s) => (
              <div key={s.label} className="text-2xs text-text-muted truncate">{s.label.split(" ").pop()}</div>
            ))}
          </div>
          {["BTC", "ETH", "SOL"].map((token) => (
            <div key={token} className="grid grid-cols-5 gap-1">
              {sentiments.map((s) => (
                <div key={`${token}-${s.label}`} className="relative">
                  <input
                    type="number"
                    defaultValue={Math.floor(Math.random() * 40 + 10)}
                    className="w-full px-1 py-1.5 text-center text-2xs font-mono bg-bg-primary border border-border-subtle rounded text-text-secondary focus:border-accent-cyan/40 focus:outline-none"
                    min="0" max="100"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <button className="w-full btn-primary text-xs py-2" disabled>
          Save Strategy (Encrypted)
        </button>
      </div>
    </div>
  );
}

// ── Main Vault Page ──────────────────────────────────────────────
export default function VaultPage() {
  const { fetchPrices } = useMarketStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchPrices();
  }, [fetchPrices]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Vault</h1>
          <p className="text-sm text-text-secondary mt-1">Manage your encrypted balances and auto-invest strategies</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <VaultBalances />
            <AutoInvestPanel />
          </div>
          <div>
            <VaultForm />
          </div>
        </div>
      </main>
    </div>
  );
}
