import React, { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { colors } from "../styles/theme";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Access the toast API. Must be called from within <ToastProvider>. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

let counter = 0;

const META: Record<ToastType, { color: string; icon: React.ReactNode }> = {
  success: { color: colors.green, icon: <CheckCircle size={18} /> },
  error: { color: colors.red, icon: <XCircle size={18} /> },
  warning: { color: colors.orange, icon: <AlertTriangle size={18} /> },
  info: { color: colors.blue, icon: <Info size={18} /> },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++counter;
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const api: ToastApi = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    warning: (m) => push("warning", m),
    info: (m) => push("info", m),
  };

  return (
    <ToastContext.Provider value={api}>
      {/* Global keyframes used by toasts and <Spinner> */}
      <style>{`
        @keyframes vs-toast-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes vs-spin { to { transform: rotate(360deg); } }
      `}</style>
      {children}
      <div
        style={{
          position: "fixed", top: 16, right: 16, zIndex: 2000,
          display: "flex", flexDirection: "column", gap: 10, maxWidth: 380,
        }}
      >
        {toasts.map((t) => {
          const meta = META[t.type];
          return (
            <div
              key={t.id}
              role="alert"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: colors.bgCard, border: `1px solid ${meta.color}`,
                borderLeft: `4px solid ${meta.color}`, borderRadius: 8,
                padding: "12px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                animation: "vs-toast-in 0.2s ease-out",
              }}
            >
              <span style={{ color: meta.color, flexShrink: 0, display: "flex" }}>{meta.icon}</span>
              <span style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                aria-label="Dismiss"
                style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSecondary, display: "flex" }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
