import React from "react";
import { colors } from "../styles/theme";

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accentColor?: string;
  icon?: React.ReactNode;
}

export function KpiCard({ label, value, sub, accentColor = colors.green, icon }: KpiCardProps) {
  return (
    <div style={{
      background: colors.bgCard, border: `1px solid ${colors.border}`,
      borderRadius: 8, padding: "20px 24px", flex: 1, minWidth: 160,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1 }}>
          {label}
        </span>
        {icon && <span style={{ color: colors.textMuted }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accentColor, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
          {sub}
        </div>
      )}
      <div style={{ marginTop: 12, height: 2, background: colors.border, borderRadius: 1 }}>
        <div style={{ height: 2, width: "60%", background: accentColor, borderRadius: 1, opacity: 0.4 }} />
      </div>
    </div>
  );
}
