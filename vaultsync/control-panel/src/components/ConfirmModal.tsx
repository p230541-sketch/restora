import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { colors } from "../styles/theme";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { Spinner } from "./Spinner";

interface Props {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true the modal shows a spinner and locks its controls. */
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Reusable confirmation dialog. Dismissable via Close, backdrop click, or ESC (unless loading). */
export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  const dismiss = () => {
    if (!loading) onClose();
  };
  useEscapeKey(dismiss);

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed", inset: 0, background: "rgba(1,4,9,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#161b22", border: `1px solid ${colors.border}`,
          borderRadius: 12, padding: 28, width: 440, maxWidth: "92vw",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <AlertTriangle size={22} color={colors.blue} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: colors.textPrimary }}>{title}</div>
          </div>
          <button
            onClick={dismiss}
            disabled={loading}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: loading ? "default" : "pointer", color: colors.textSecondary, display: "flex" }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
          {message}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={dismiss}
            disabled={loading}
            style={{
              background: "none", border: `1px solid ${colors.border}`, borderRadius: 6,
              padding: "9px 18px", cursor: loading ? "default" : "pointer",
              color: colors.textSecondary, fontSize: 13,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: colors.blue, border: "none", borderRadius: 6,
              padding: "9px 18px", cursor: loading ? "default" : "pointer",
              color: "#fff", fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8, opacity: loading ? 0.85 : 1,
            }}
          >
            {loading && <Spinner size={14} />}
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
