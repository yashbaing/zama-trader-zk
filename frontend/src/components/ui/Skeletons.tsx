"use client";

/**
 * Skeleton Loading Components
 *
 * FHE operations are slow (10-30 seconds for encrypted computation).
 * These skeletons provide visual feedback while:
 *   - Decrypting vault balances via reencryption
 *   - Encrypting order data before submission
 *   - Waiting for trade settlement
 *   - Fetching market data
 */

const shimmerStyle: React.CSSProperties = {
  background:
    "linear-gradient(90deg, rgba(26,34,54,0.4) 25%, rgba(36,48,73,0.4) 50%, rgba(26,34,54,0.4) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s ease-in-out infinite",
  borderRadius: 6,
};

// Base shimmer element
function Shimmer({
  width,
  height = 14,
  style = {},
}: {
  width: string | number;
  height?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        ...shimmerStyle,
        width: typeof width === "number" ? `${width}px` : width,
        height,
        ...style,
      }}
    />
  );
}

/**
 * Skeleton for a single stat card (Dashboard)
 */
export function StatCardSkeleton() {
  return (
    <div
      style={{
        padding: 14,
        background: "rgba(12,16,24,0.6)",
        border: "1px solid rgba(26,34,54,0.6)",
        borderRadius: 10,
      }}
    >
      <Shimmer width={80} height={10} style={{ marginBottom: 10 }} />
      <Shimmer width={120} height={22} style={{ marginBottom: 6 }} />
      <Shimmer width={60} height={10} />
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  );
}

/**
 * Skeleton for a token row in Holdings (Dashboard/Vault)
 */
export function TokenRowSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 16px",
        borderBottom: "1px solid rgba(26,34,54,0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Shimmer width={34} height={34} style={{ borderRadius: 8 }} />
        <div>
          <Shimmer width={40} height={13} style={{ marginBottom: 4 }} />
          <Shimmer width={70} height={10} />
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <Shimmer width={80} height={13} style={{ marginBottom: 4, marginLeft: "auto" }} />
        <Shimmer width={60} height={10} style={{ marginLeft: "auto" }} />
      </div>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  );
}

/**
 * Skeleton for the price chart area
 */
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: "2px solid rgba(0,229,255,0.15)",
          borderTop: "2px solid #00e5ff",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <span style={{ fontSize: 11, color: "#5a6a8a" }}>Loading chart data...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

/**
 * Skeleton for the order book
 */
export function OrderBookSkeleton() {
  return (
    <div style={{ padding: "6px 10px" }}>
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "3px 0",
          }}
        >
          <Shimmer width={70} height={11} />
          <Shimmer width={50} height={11} />
        </div>
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  );
}

/**
 * Skeleton for the open orders table
 */
export function OrderTableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ padding: "8px 14px" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 20,
            padding: "10px 0",
            borderBottom: "1px solid rgba(26,34,54,0.3)",
          }}
        >
          <Shimmer width={70} height={12} />
          <Shimmer width={35} height={12} />
          <Shimmer width={45} height={12} />
          <Shimmer width={60} height={12} />
          <Shimmer width={60} height={12} />
          <Shimmer width={50} height={12} />
        </div>
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  );
}

/**
 * Full-page loading state for FHE initialization
 */
export function FheLoadingOverlay() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(6,8,13,0.85)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        {/* Animated lock icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "rgba(179,136,255,0.08)",
            border: "1px solid rgba(179,136,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 8 8"
            fill="#b388ff"
          >
            <path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z" />
          </svg>
        </div>

        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#e8edf5",
            marginBottom: 6,
          }}
        >
          Initializing FHE Client
        </p>
        <p
          style={{
            fontSize: 12,
            color: "#8898b5",
            maxWidth: 280,
            lineHeight: 1.5,
          }}
        >
          Generating encryption keys in your browser. This may take a few seconds...
        </p>

        {/* Progress dots */}
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "center",
            marginTop: 16,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#b388ff",
                opacity: 0.3,
                animation: `dot-pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(0.96)} }
        @keyframes dot-pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
      `}</style>
    </div>
  );
}

/**
 * Encrypted data placeholder — shown in place of values
 * that haven't been decrypted yet.
 */
export function EncryptedPlaceholder({
  width = 80,
  inline = false,
}: {
  width?: number;
  inline?: boolean;
}) {
  return (
    <span
      style={{
        display: inline ? "inline-flex" : "flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        background: "rgba(179,136,255,0.06)",
        border: "1px solid rgba(179,136,255,0.15)",
        borderRadius: 4,
        fontSize: 10,
        color: "#b388ff",
        fontFamily: "monospace",
        width: inline ? "auto" : width,
      }}
    >
      <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor">
        <path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z" />
      </svg>
      ••••••
    </span>
  );
}
