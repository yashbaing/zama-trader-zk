"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

// ── Types ────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info" | "warning" | "encryption";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  txHash?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  /** Shortcut: Show success toast for a completed transaction */
  txSuccess: (title: string, txHash: string) => void;
  /** Shortcut: Show encryption progress toast */
  encrypting: (message?: string) => string;
  /** Shortcut: Remove a specific toast by id */
  dismiss: (id: string) => void;
}

// ── Context ──────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 10);
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto-remove after duration
    const duration = toast.duration || 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const txSuccess = useCallback(
    (title: string, txHash: string) => {
      addToast({ type: "success", title, txHash, duration: 8000 });
    },
    [addToast]
  );

  const encrypting = useCallback(
    (message = "Encrypting with FHE...") => {
      return addToast({
        type: "encryption",
        title: "Encrypting",
        message,
        duration: 0, // Manual dismiss
      }) as unknown as string;
    },
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        txSuccess,
        encrypting,
        dismiss: removeToast,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

// ── Toast Container ──────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 380,
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ── Single Toast ─────────────────────────────────────────────────

const TOAST_STYLES: Record<
  ToastType,
  { bg: string; border: string; icon: string; iconColor: string }
> = {
  success: {
    bg: "rgba(0,230,118,0.06)",
    border: "rgba(0,230,118,0.2)",
    icon: "✓",
    iconColor: "#00e676",
  },
  error: {
    bg: "rgba(255,82,82,0.06)",
    border: "rgba(255,82,82,0.2)",
    icon: "✕",
    iconColor: "#ff5252",
  },
  info: {
    bg: "rgba(0,229,255,0.06)",
    border: "rgba(0,229,255,0.2)",
    icon: "ℹ",
    iconColor: "#00e5ff",
  },
  warning: {
    bg: "rgba(255,215,64,0.06)",
    border: "rgba(255,215,64,0.2)",
    icon: "⚠",
    iconColor: "#ffd740",
  },
  encryption: {
    bg: "rgba(179,136,255,0.06)",
    border: "rgba(179,136,255,0.2)",
    icon: "🔒",
    iconColor: "#b388ff",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const style = TOAST_STYLES[toast.type];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      style={{
        padding: "12px 14px",
        background: `linear-gradient(135deg, ${style.bg}, rgba(12,16,24,0.95))`,
        border: `1px solid ${style.border}`,
        borderRadius: 10,
        backdropFilter: "blur(12px)",
        display: "flex",
        gap: 10,
        alignItems: "start",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(20px)",
        transition: "all 0.3s ease-out",
        cursor: "pointer",
      }}
      onClick={() => onDismiss(toast.id)}
    >
      {/* Icon */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `${style.iconColor}15`,
          border: `1px solid ${style.iconColor}25`,
          fontSize: 12,
          flexShrink: 0,
          color: style.iconColor,
        }}
      >
        {toast.type === "encryption" ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 8 8"
            fill="currentColor"
            style={{
              animation:
                toast.type === "encryption"
                  ? "pulse 1.5s ease-in-out infinite"
                  : "none",
            }}
          >
            <path d="M4 0C2.34 0 1 1.34 1 3v1H0v4h8V4H7V3c0-1.66-1.34-3-3-3zm0 1c1.1 0 2 .9 2 2v1H2V3c0-1.1.9-2 2-2z" />
          </svg>
        ) : (
          style.icon
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#e8edf5",
            marginBottom: toast.message || toast.txHash ? 3 : 0,
          }}
        >
          {toast.title}
        </p>
        {toast.message && (
          <p style={{ fontSize: 11, color: "#8898b5", lineHeight: 1.4 }}>
            {toast.message}
          </p>
        )}
        {toast.txHash && (
          <p style={{ fontSize: 10, fontFamily: "monospace", color: "#00e5ff", marginTop: 3 }}>
            Tx: {toast.txHash.slice(0, 10)}...{toast.txHash.slice(-6)}
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        style={{
          background: "none",
          border: "none",
          color: "#5a6a8a",
          cursor: "pointer",
          fontSize: 14,
          padding: 0,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

export default ToastProvider;
