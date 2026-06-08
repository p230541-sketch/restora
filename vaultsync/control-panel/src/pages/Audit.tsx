import React, { useEffect, useMemo, useState } from "react";
import { Search, ScrollText } from "lucide-react";
import { api, AuditEntry } from "../api/client";
import { colors } from "../styles/theme";
import { TopBar } from "../components/TopBar";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toast";
import { formatTimestamp } from "../lib/format";

const th: React.CSSProperties = { padding: "10px 12px", fontSize: 12, fontWeight: 600, color: colors.textSecondary, textAlign: "left", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "11px 12px", fontSize: 13, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderMuted}`, verticalAlign: "top" };

const control: React.CSSProperties = {
  background: "#010409", border: `1px solid ${colors.border}`, borderRadius: 6,
  padding: "0 10px", display: "flex", alignItems: "center", gap: 8,
};

// Map action prefixes to a colour for quick scanning
function actionColor(action: string): string {
  if (action.startsWith("key.")) return colors.yellow;
  if (action.startsWith("user.")) return colors.blue;
  if (action.startsWith("settings.")) return colors.orange;
  if (action.startsWith("node.")) return colors.green;
  return colors.textSecondary;
}

const fmt = (ts: string) => formatTimestamp(ts, "short");

export function Audit() {
  const toast = useToast();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.getAudit(300).then(setEntries).catch(() => toast.error("Could not load audit log.")).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      `${e.actor_name ?? ""} ${e.action} ${e.target ?? ""} ${e.detail ?? ""}`.toLowerCase().includes(q)
    );
  }, [entries, search]);

  return (
    <div style={{ flex: 1 }}>
      <TopBar title="Audit Log" />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, display: "flex", alignItems: "center", gap: 8 }}>
              <ScrollText size={20} color={colors.blue} /> Audit Log
            </div>
            <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              Privileged actions across the platform · {entries.length} record{entries.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ ...control }}>
            <Search size={13} color={colors.textSecondary} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search actor, action, target…"
              style={{ background: "none", border: "none", outline: "none", color: colors.textPrimary, fontSize: 12, padding: "8px 0", width: 240 }} />
          </div>
        </div>

        {loading ? (
          <div style={{ color: colors.textSecondary, display: "flex", gap: 8, alignItems: "center" }}>
            <Spinner size={14} color={colors.textSecondary} /> Loading…
          </div>
        ) : (
          <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Time</th>
                  <th style={th}>Actor</th>
                  <th style={th}>Action</th>
                  <th style={th}>Target</th>
                  <th style={th}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: colors.textSecondary, padding: 32 }}>No audit entries match.</td></tr>
                ) : (
                  filtered.map((e) => (
                    <tr key={e.id}>
                      <td style={{ ...td, color: colors.textSecondary, fontFamily: "monospace", whiteSpace: "nowrap" }}>{fmt(e.created_at)}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{e.actor_name ?? "system"}</div>
                        {e.actor_role && <div style={{ fontSize: 11, color: colors.textMuted }}>{e.actor_role}</div>}
                      </td>
                      <td style={td}>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: "monospace", color: actionColor(e.action), background: colors.bgCardHover, border: `1px solid ${actionColor(e.action)}` }}>
                          {e.action}
                        </span>
                      </td>
                      <td style={{ ...td, color: colors.textSecondary, fontFamily: "monospace", wordBreak: "break-all" }}>{e.target ?? "—"}</td>
                      <td style={{ ...td, color: colors.textSecondary }}>{e.detail ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
