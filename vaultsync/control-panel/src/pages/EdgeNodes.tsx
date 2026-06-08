import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Server } from "lucide-react";
import { api, NodeRecord } from "../api/client";
import { colors } from "../styles/theme";
import { TopBar } from "../components/TopBar";
import { StatusBadge } from "../components/StatusBadge";
import { ProvisionNodeModal } from "../components/ProvisionNodeModal";
import { useAuth } from "../auth/AuthContext";

function timeSince(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export function EdgeNodes() {
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [provisionOpen, setProvisionOpen] = useState(false);
  const { hasRole } = useAuth();
  const canProvision = hasRole("SysAdmin");
  const query = (searchParams.get("q") ?? "").toLowerCase();

  function loadNodes() {
    api.getNodes().then((n) => { setNodes(n); setLoading(false); }).catch(() => setLoading(false));
  }

  useEffect(() => { loadNodes(); }, []);

  const visibleNodes = useMemo(() => {
    if (!query) return nodes;
    return nodes.filter(
      (n) =>
        n.node_id.toLowerCase().includes(query) ||
        (n.ip_address ?? "").toLowerCase().includes(query)
    );
  }, [nodes, query]);

  return (
    <div style={{ flex: 1 }}>
      <TopBar />
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>Edge Nodes</div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
            {query
              ? `${visibleNodes.length} of ${nodes.length} node${nodes.length !== 1 ? "s" : ""} matching "${query}"`
              : `${nodes.length} registered node${nodes.length !== 1 ? "s" : ""}`}
          </div>
        </div>

        {loading ? (
          <div style={{ color: colors.textSecondary }}>Loading nodes...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {visibleNodes.map((node) => (
              <Link key={node.node_id} to={`/nodes/${node.node_id}`} style={{ textDecoration: "none" }}>
                <div style={{
                  background: colors.bgCard, border: `1px solid ${colors.border}`,
                  borderRadius: 8, padding: 20, cursor: "pointer",
                  transition: "border-color 0.15s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <Server size={18} color={colors.blue} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>{node.node_id}</span>
                    </div>
                    <StatusBadge status={node.status} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
                    <div>
                      <div style={{ color: colors.textSecondary }}>IP ADDRESS</div>
                      <div style={{ color: colors.textPrimary, marginTop: 2 }}>{node.ip_address ?? "—"}</div>
                    </div>
                    <div>
                      <div style={{ color: colors.textSecondary }}>LAST PING</div>
                      <div style={{ color: colors.textPrimary, marginTop: 2 }}>{timeSince(node.last_ping)}</div>
                    </div>
                    <div>
                      <div style={{ color: colors.textSecondary }}>BACKUPS (24H)</div>
                      <div style={{ color: colors.textPrimary, marginTop: 2 }}>{node.backups_24h}</div>
                    </div>
                    <div>
                      <div style={{ color: colors.textSecondary }}>LAST STATUS</div>
                      <div style={{ marginTop: 2 }}>
                        {node.last_backup_status
                          ? <StatusBadge status={node.last_backup_status} />
                          : <span style={{ color: colors.textMuted }}>—</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {/* Provision new node card — SysAdmin only */}
            {canProvision && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setProvisionOpen(true)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setProvisionOpen(true); }}
                style={{
                  background: colors.bgCard, border: `1px dashed ${colors.border}`,
                  borderRadius: 8, padding: 20, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", minHeight: 160,
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: colors.bgCardHover, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 22, color: colors.textSecondary }}>+</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>Provision New Node</div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>Click to deploy backup daemon</div>
              </div>
            )}
          </div>
        )}
      </div>

      {provisionOpen && (
        <ProvisionNodeModal
          onClose={() => setProvisionOpen(false)}
          onProvisioned={() => loadNodes()}
        />
      )}
    </div>
  );
}
