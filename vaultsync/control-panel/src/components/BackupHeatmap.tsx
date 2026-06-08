import React, { useMemo } from "react";
import { colors } from "../styles/theme";
import { BackupRecord } from "../api/client";

interface Props {
  backups: BackupRecord[];
}

function getColor(count: number, hasFailure: boolean): string {
  if (hasFailure) return colors.red;
  if (count === 0) return colors.bgCardHover;
  if (count === 1) return "#1a4731";
  if (count === 2) return "#196c2e";
  if (count <= 4) return "#2da44e";
  return colors.green;
}

export function BackupHeatmap({ backups }: Props) {
  const cells = useMemo(() => {
    const map: Record<string, { count: number; hasFailure: boolean }> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map[key] = { count: 0, hasFailure: false };
    }
    for (const b of backups) {
      const key = b.created_at.slice(0, 10);
      if (map[key]) {
        map[key].count++;
        if (b.status === "fail" || b.status === "critical_failure") {
          map[key].hasFailure = true;
        }
      }
    }
    return Object.entries(map).map(([date, v]) => ({ date, ...v }));
  }, [backups]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Backup Density</div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            System-wide backup activity across all edge clusters for the last 30 days
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: colors.textSecondary }}>
          <span>Less</span>
          {["#1c2128", "#1a4731", "#196c2e", "#2da44e", colors.green].map((c, i) => (
            <span key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c, display: "inline-block" }} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(30, 1fr)",
        gap: 3, padding: "16px", background: colors.bgCard,
        border: `1px solid ${colors.border}`, borderRadius: 8,
      }}>
        {cells.map(({ date, count, hasFailure }) => (
          <div
            key={date}
            title={`${date}: ${count} backup(s)${hasFailure ? " — has failures" : ""}`}
            style={{
              aspectRatio: "1", borderRadius: 2,
              background: getColor(count, hasFailure),
              cursor: "default",
              transition: "transform 0.1s",
            }}
          />
        ))}
      </div>
    </div>
  );
}
