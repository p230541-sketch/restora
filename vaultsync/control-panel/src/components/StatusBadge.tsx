import React from "react";
import { colors } from "../styles/theme";

type Status = "pass" | "fail" | "critical_failure" | "pending" | "connected" | "disconnected" | "node_disconnected" | "online" | "offline";

const STATUS_CONFIG: Record<Status, { label: string; bg: string; color: string }> = {
  pass:               { label: "Verified",          bg: colors.greenDim,   color: colors.green },
  fail:               { label: "Failed",             bg: colors.redDim,     color: colors.red },
  critical_failure:   { label: "Critical Failure",   bg: colors.redDim,     color: colors.red },
  pending:            { label: "Pending",            bg: colors.yellowDim,  color: colors.yellow },
  connected:          { label: "Connected",          bg: colors.greenDim,   color: colors.green },
  disconnected:       { label: "Disconnected",       bg: colors.orangeDim,  color: colors.orange },
  node_disconnected:  { label: "Node Disconnected",  bg: colors.redDim,     color: colors.red },
  online:             { label: "Online",             bg: colors.greenDim,   color: colors.green },
  offline:            { label: "Offline",            bg: colors.redDim,     color: colors.red },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as Status] ?? { label: status, bg: colors.bgCard, color: colors.textSecondary };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600,
      background: cfg.bg, color: cfg.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}
