"use client";

import { useState, useEffect } from "react";

interface TxConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  type: "order" | "deposit" | "withdraw" | "cancel";
  details: {
    pair?: string;
    side?: string;
    price?: string;
    amount?: string;
    token?: string;
    total?: string;
  };
}

type EncryptionStage = "idle" | "encrypting" | "submitting" | "confirming" | "done" | "error";

/**
 * Transaction Confirmation Modal
 *
 * Shows the encryption process step-by-step:
 *   1. Review order details (plaintext, shown only to user)
 *   2. FHE encryption animation (values being encrypted)
 *   3. Submission to chain (encrypted data sent)
 *   4. Confirmation (tx mined)
 *
 * This gives users visibility into the privacy process.
 */
export default function TxConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  type,
  details,
}: TxConfirmProps) {
  const [stage, setStage] = useState<EncryptionStage>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStage("idle");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setStage("encrypting");
      // Simulate encryption delay (real FHE takes 2-5s)
      await new Promise((r) => setTimeout(r, 2000));

      setStage("submitting");
      await onConfirm();

      setStage("confirming");
      await new Promise((r) => setTimeout(r, 1500));

      setStage("done");
      setTimeout(onClose, 2000);
    } catch (err: any) {
      setError(err.message || "Transaction failed");
      setStage("error");
    }
  };

  const stageInfo: Record<EncryptionStage, { label: string; color: string; description: string }> = {
    idle: { label: "Review", color: "#00e5ff", description: "Verify your order details" },
    encrypting: { label: "Encrypting", color: "#b388ff", description: "Encrypting values with FHE..." },
    submitting: { label: "Submitting", color: "#ffd740", description: "Sending encrypted tx to chain..." },
    confirming: { label: "Confirming", color: "#ffd740", description: "Waiting for block confirmation..." },
    done: { label: "Complete", color: "#00e676", description: "Transaction confirmed!" },
    error: { label: "Failed", color: "#ff5252", description: error || "Unknown error" },
  };

  const current = stageInfo[stage];
  const steps = ["encrypting", "submitting", "confirming", "done"] as const;
  const stepIndex = steps.indexOf(stage as any);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(6,8,13,0.8)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && stage === "idle") onClose();
      }}
    >
      <div
        style={{
          width: 400,
          maxWidth: "90vw",
          background: "rgba(12,16,24,0.95)",
          border: "1px solid rgba(26,34,54,0.8)",
          borderRadius: 14,
          padding: 20,
          animation: "slideUp 0.3s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>
            {type === "order" ? "Confirm Order" : type === "deposit" ? "Confirm Deposit" : type === "withdraw" ? "Confirm Withdrawal" : "Confirm Cancellation"}
          </h3>
          {stage === "idle" && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#5a6a8a",
                cursor: "pointer",
                fontSize: 18,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Order Details */}
        <div
          style={{
            padding: 14,
            background: "rgba(6,8,13,0.6)",
            borderRadius: 10,
            border: "1px solid rgba(26,34,54,0.5)",
            marginBottom: 16,
          }}
        >
          {details.pair && (
            <Row label="Pair" value={details.pair} />
          )}
          {details.side && (
            <Row
              label="Side"
              value={details.side}
              valueColor={details.side === "BUY" ? "#00e676" : "#ff5252"}
            />
          )}
          {details.token && <Row label="Token" value={details.token} />}
          {details.price && (
            <Row
              label="Price"
              value={details.price}
              encrypted={stage !== "idle"}
            />
          )}
          {details.amount && (
            <Row
              label="Amount"
              value={details.amount}
              encrypted={stage !== "idle"}
            />
          )}
          {details.total && (
            <Row label="Total" value={details.total} encrypted={stage !== "idle"} />
          )}
        </div>

        {/* Encryption Progress */}
        {stage !== "idle" && (
          <div style={{ marginBottom: 16 }}>
            {/* Progress bar */}
            <div
              style={{
                display: "flex",
                gap: 4,
                marginBottom: 10,
              }}
            >
              {steps.map((s, i) => (
                <div
                  key={s}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background:
                      i <= stepIndex
                        ? current.color
                        : "rgba(26,34,54,0.6)",
                    transition: "background 0.5s",
                  }}
                />
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {stage !== "done" && stage !== "error" && (
                <div
                  style={{
                    width: 16,
                    height: 16,
                    border: `2px solid ${current.color}30`,
                    borderTop: `2px solid ${current.color}`,
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
              )}
              {stage === "done" && (
                <span style={{ color: "#00e676", fontSize: 16 }}>✓</span>
              )}
              {stage === "error" && (
                <span style={{ color: "#ff5252", fontSize: 16 }}>✕</span>
              )}
              <div>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: current.color,
                  }}
                >
                  {current.label}
                </p>
                <p style={{ fontSize: 11, color: "#8898b5" }}>
                  {current.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {stage === "idle" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                background: "transparent",
                color: "#8898b5",
                border: "1px solid rgba(26,34,54,0.6)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: "rgba(0,229,255,0.1)",
                color: "#00e5ff",
                border: "1px solid rgba(0,229,255,0.2)",
              }}
            >
              Encrypt & Submit
            </button>
          </div>
        )}

        {stage === "error" && (
          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              background: "rgba(255,82,82,0.1)",
              color: "#ff5252",
              border: "1px solid rgba(255,82,82,0.2)",
            }}
          >
            Close
          </button>
        )}
      </div>

      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

function Row({
  label,
  value,
  valueColor,
  encrypted = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  encrypted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
      }}
    >
      <span style={{ fontSize: 12, color: "#5a6a8a" }}>{label}</span>
      {encrypted ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: "#b388ff",
            fontFamily: "monospace",
          }}
        >
          <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor">
            <path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z" />
          </svg>
          encrypted
        </span>
      ) : (
        <span
          style={{
            fontSize: 12,
            fontFamily: "monospace",
            fontWeight: 500,
            color: valueColor || "#e8edf5",
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
