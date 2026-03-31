"use client";

import { useWalletStore } from "@/store";
import { shortenAddress } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◈" },
  { href: "/trade", label: "Trade", icon: "⇌" },
  { href: "/vault", label: "Vault", icon: "◎" },
  { href: "/copy-trading", label: "Copy", icon: "⊕" },
  { href: "/history", label: "History", icon: "☰" },
];

export default function Header() {
  const { address, isConnected, isConnecting, fheReady, connect, disconnect } = useWalletStore();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-bg-primary/90 backdrop-blur-xl">
      <div className="flex items-center justify-between h-14 px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-cyan/30 to-accent-violet/30 flex items-center justify-center border border-accent-cyan/20 group-hover:border-accent-cyan/40 transition-colors">
            <span className="text-xs font-bold text-accent-cyan">ZK</span>
          </div>
          <span className="font-display font-semibold text-text-primary tracking-tight">
            ZKTrader
          </span>
          <span className="encrypted-badge ml-1 hidden sm:inline-flex">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z"/></svg>
            FHE
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "text-accent-cyan bg-accent-cyan/8 border border-accent-cyan/15"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent"
                }`}
              >
                <span className="text-xs opacity-70">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Wallet */}
        <div className="flex items-center gap-3">
          {fheReady && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/5 border border-success/15">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-slow" />
              <span className="text-2xs text-success font-mono">FHE Active</span>
            </div>
          )}

          {isConnected && address ? (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-medium text-sm font-mono text-text-secondary hover:text-text-primary hover:border-border-bright transition-all"
            >
              <div className="w-2 h-2 rounded-full bg-success" />
              {shortenAddress(address)}
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="btn-primary"
            >
              {isConnecting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4" strokeDashoffset="10" /></svg>
                  Connecting...
                </span>
              ) : (
                "Connect Wallet"
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex md:hidden items-center gap-1 px-4 pb-2 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "text-accent-cyan bg-accent-cyan/8 border border-accent-cyan/15"
                  : "text-text-secondary border border-transparent"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
