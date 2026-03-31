"use client";

import { useState, useEffect } from "react";

interface FearGreedData {
  value: number;
  label: string;
  sentiment: number;
  timestamp: number;
}

const SENTIMENT_LABELS = [
  "Extreme Fear",
  "Fear",
  "Neutral",
  "Greed",
  "Extreme Greed",
];

const SENTIMENT_COLORS = [
  "#ff5252", // Extreme Fear — red
  "#ffa726", // Fear — orange
  "#8898b5", // Neutral — gray
  "#66bb6a", // Greed — light green
  "#00e676", // Extreme Greed — bright green
];

/**
 * Fear & Greed Gauge Component
 *
 * Displays the current Crypto Fear & Greed Index as an animated gauge.
 * Used in the Vault page to show which auto-invest bracket is active.
 */
export default function FearGreedGauge({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch_data() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
        const res = await fetch(`${apiUrl}/fear-greed`);
        const json = await res.json();
        setData(json);
      } catch {
        // Fallback demo data
        setData({
          value: 28,
          label: "Fear",
          sentiment: 1,
          timestamp: Date.now(),
        });
      } finally {
        setLoading(false);
      }
    }

    fetch_data();
    const interval = setInterval(fetch_data, 300_000); // Refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div style={{
        padding: compact ? 10 : 16,
        background: "rgba(12,16,24,0.7)",
        border: "1px solid rgba(26,34,54,0.7)",
        borderRadius: 12,
      }}>
        <div style={{ height: compact ? 30 : 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 12, color: "#5a6a8a" }}>Loading index...</span>
        </div>
      </div>
    );
  }

  const color = SENTIMENT_COLORS[data.sentiment] || "#8898b5";
  const label = SENTIMENT_LABELS[data.sentiment] || "Unknown";

  if (compact) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 12px", borderRadius: 8,
        background: `${color}08`, border: `1px solid ${color}25`,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "monospace" }}>
          {data.value}
        </span>
        <span style={{ fontSize: 11, color, fontWeight: 500 }}>{label}</span>
      </div>
    );
  }

  return (
    <div style={{
      padding: 16,
      background: "rgba(12,16,24,0.7)",
      border: "1px solid rgba(26,34,54,0.7)",
      borderRadius: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e8edf5" }}>Fear & Greed Index</span>
        <span style={{
          fontSize: 10, padding: "2px 10px", borderRadius: 10,
          background: `${color}10`, color, border: `1px solid ${color}20`,
          fontWeight: 600,
        }}>
          {data.value} — {label}
        </span>
      </div>

      {/* Gauge bar */}
      <div style={{ position: "relative", height: 12, background: "#06080d", borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
        {/* Gradient fill */}
        <div style={{
          position: "absolute", inset: 0,
          width: `${data.value}%`,
          borderRadius: 6,
          background: "linear-gradient(90deg, #ff5252 0%, #ffa726 25%, #8898b5 50%, #66bb6a 75%, #00e676 100%)",
          transition: "width 1s ease-out",
        }} />
        {/* Indicator dot */}
        <div style={{
          position: "absolute", top: "50%", left: `${data.value}%`,
          transform: "translate(-50%, -50%)",
          width: 14, height: 14, borderRadius: "50%",
          background: "#fff", border: "2.5px solid #06080d",
          boxShadow: `0 0 8px ${color}60`,
          transition: "left 1s ease-out",
        }} />
      </div>

      {/* Scale labels */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "#5a6a8a" }}>
        <span>Extreme Fear</span>
        <span>Neutral</span>
        <span>Extreme Greed</span>
      </div>

      {/* Strategy hint */}
      <div style={{
        marginTop: 12, padding: "8px 10px", borderRadius: 8,
        background: `${color}06`, border: `1px solid ${color}12`,
      }}>
        <p style={{ fontSize: 10.5, color: "#8898b5", lineHeight: 1.5 }}>
          {data.sentiment <= 1 && "Market is fearful. Historically a good time to accumulate. Your auto-invest strategy increases BTC/ETH allocation."}
          {data.sentiment === 2 && "Market is neutral. Balanced allocation across your portfolio."}
          {data.sentiment >= 3 && "Market is greedy. Consider taking profits. Your auto-invest strategy reduces risk exposure."}
        </p>
      </div>
    </div>
  );
}
