import React, { useEffect, useMemo, useState } from "react";
import { CheckCheck, Check, Search } from "lucide-react";
import { api, Alert, AlertSeverity } from "../api/client";
import { colors } from "../styles/theme";
import { TopBar } from "../components/TopBar";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toast";
import { SEVERITY } from "../lib/severity";
import { formatTimestamp } from "../lib/format";

type SevFilter = "all" | AlertSeverity;
type StatusFilter = "all" | "unread" | "ack";

const control: React.CSSProperties = {
  background: "#010409", border: `1px solid ${colors.border}`, borderRadius: 6,
  padding: "7px 10px", color: colors.textPrimary, fontSize: 12, outline: "none",
};

const fmt = (ts: string) => formatTimestamp(ts, "compact");

export function Alerts() {
  const toast = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [sev, setSev] = useState<SevFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  function load() {
    api.getAlerts(200).then((d) => setAlerts(d.alerts)).catch(() => toast.error("Could not load alerts.")).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter((a) => {
      if (sev !== "all" && a.severity !== sev) return false;
      if (status === "unread" && a.acknowledged) return false;
      if (status === "ack" && !a.acknowledged) return false;
      if (q && !`${a.message} ${a.type} ${a.node_id ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [alerts, sev, status, search]);

  const unread = alerts.filter((a) => !a.acknowledged).length;

  async function ackOne(id: string) { await api.ackAlert(id); load(); }
  async function ackAll() { await api.ackAllAlerts(); load(); toast.success("All alerts acknowledged."); }

  return (
    <div style={{ flex: 1 }}>
      <TopBar title="Alerts" />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>Alert History</div>
            <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              {alerts.length} alert{alerts.length !== 1 ? "s" : ""} · {unread} unread
            </div>
          </div>
          {unread > 0 && (
            <button onClick={ackAll} style={{ background: colors.blue, border: "none", borderRadius: 6, padding: "9px 16px", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <CheckCheck size={15} /> Mark all read
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, ...control, padding: "0 10px" }}>
            <Search size={13} color={colors.textSecondary} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search alerts…"
              style={{ background: "none", border: "none", outline: "none", color: colors.textPrimary, fontSize: 12, padding: "7px 0", width: 200 }} />
          </div>
          <select value={sev} onChange={(e) => setSev(e.target.value as SevFilter)} style={control}>
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} style={control}>
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="ack">Acknowledged</option>
          </select>
          <span style={{ fontSize: 12, color: colors.textSecondary, marginLeft: "auto" }}>{filtered.length} shown</span>
        </div>

        {loading ? (
          <div style={{ color: colors.textSecondary, display: "flex", gap: 8, alignItems: "center" }}>
            <Spinner size={14} color={colors.textSecondary} /> Loading…
          </div>
        ) : (
          <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: colors.textSecondary, fontSize: 13 }}>No alerts match.</div>
            ) : (
              filtered.map((a) => {
                const { color, Icon } = SEVERITY[a.severity];
                return (
                  <div key={a.id} style={{
                    display: "flex", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${colors.borderMuted}`,
                    background: a.acknowledged ? "transparent" : "rgba(56,139,253,0.05)",
                  }}>
                    <span style={{ color, flexShrink: 0, marginTop: 1 }}><Icon size={16} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: colors.textPrimary }}>{a.message}</div>
                      <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                        <span style={{ color, fontWeight: 600 }}>{a.severity.toUpperCase()}</span>
                        {" · "}{a.type}{a.node_id ? ` · ${a.node_id}` : ""} · {fmt(a.created_at)}
                      </div>
                    </div>
                    {a.acknowledged ? (
                      <span style={{ fontSize: 11, color: colors.textMuted, flexShrink: 0, alignSelf: "center" }}>read</span>
                    ) : (
                      <button onClick={() => ackOne(a.id)} title="Mark read" style={{ background: colors.bgCardHover, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "4px 8px", cursor: "pointer", color: colors.textSecondary, flexShrink: 0, alignSelf: "center", display: "flex" }}>
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
