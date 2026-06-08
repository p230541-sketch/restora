import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Zap, Cpu, MemoryStick, HardDrive, Lock } from "lucide-react";
import { api, NodeDetail as NodeDetailType, NodeMetrics, NodeRecord } from "../api/client";
import { colors } from "../styles/theme";
import { TopBar } from "../components/TopBar";
import { StatusBadge } from "../components/StatusBadge";
import { LogTerminal } from "../components/LogTerminal";
import { ConfirmModal } from "../components/ConfirmModal";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toast";
import { useAuth } from "../auth/AuthContext";
import { formatBytes, uptimeSince } from "../lib/format";
import { utilizationColor as colorFor } from "../lib/severity";

const METRICS_INTERVAL = 3000;
const HISTORY = 20;

function DonutChart({ pct, color }: { pct: number; color: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={90} height={90} viewBox="0 0 90 90">
      <circle cx={45} cy={45} r={r} fill="none" stroke={colors.border} strokeWidth={8} />
      <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 45 45)" />
      <text x={45} y={49} textAnchor="middle" fill={color} fontSize={14} fontWeight={700}>{pct.toFixed(0)}%</text>
    </svg>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const h = 40, w = 160;
  if (data.length < 2) {
    return <svg width={w} height={h} style={{ display: "block" }} />;
  }
  // Fixed 0-100 scale since these are percentages
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (Math.min(100, Math.max(0, v)) / 100) * h}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// LAST PING uses a coarser s/m-only relative format than the shared timeAgo.
function timeSince(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

export function NodeDetail() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<NodeDetailType | null>(null);
  const [metrics, setMetrics] = useState<NodeMetrics | null>(null);
  const [allNodes, setAllNodes] = useState<NodeRecord[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const cpuHist = useRef<number[]>([]);
  const ramHist = useRef<number[]>([]);
  const [, tick] = useState(0);
  const toast = useToast();
  const { hasRole } = useAuth();
  const canTrigger = hasRole("SysAdmin", "BusinessOwner");

  useEffect(() => {
    if (!id) return;
    api.getNode(id).then(setDetail).catch(console.error);
    api.getNodes().then(setAllNodes).catch(() => {});
  }, [id]);

  // Live metrics polling
  useEffect(() => {
    if (!id) return;
    let active = true;
    async function poll() {
      const m = await api.getNodeMetrics(id!);
      if (!active || !m) return;
      setMetrics(m);
      cpuHist.current = [...cpuHist.current, m.cpu_percent].slice(-HISTORY);
      ramHist.current = [...ramHist.current, m.mem_percent].slice(-HISTORY);
      tick((t) => t + 1);
    }
    poll();
    const iv = setInterval(poll, METRICS_INTERVAL);
    return () => { active = false; clearInterval(iv); };
  }, [id]);

  async function confirmTrigger() {
    if (!id) return;
    setTriggering(true);
    try {
      await api.triggerBackup(id);
      toast.success(`Immediate backup queued for ${id}.`);
      setConfirmOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to queue backup.");
    } finally {
      setTriggering(false);
    }
  }

  const node = detail?.node;
  const cpuPct = metrics?.cpu_percent ?? 0;
  const ramPct = metrics?.mem_percent ?? 0;
  const diskPct = metrics?.disk_percent ?? 0;

  const activeCount = allNodes.filter((n) => n.status === "connected").length;
  const faultCount = allNodes.length - activeCount;

  return (
    <div style={{ flex: 1 }}>
      <TopBar
        title={id ?? "Node Detail"}
        subtitle={node ? <StatusBadge status={node.status === "connected" ? "online" : "offline"} /> : undefined}
      />
      <div style={{ padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, marginBottom: 16 }}>
          {/* System Identity */}
          <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>
              System Identity
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { label: "NODE NAME", value: node?.node_id ?? "—" },
                { label: "IP ADDRESS", value: node?.ip_address ?? "—" },
                { label: "LAST PING", value: timeSince(node?.last_ping ?? null) },
                { label: "UPTIME", value: metrics ? uptimeSince(new Date(Date.now() - metrics.uptime_seconds * 1000).toISOString()) : (node ? uptimeSince(node.created_at) : "—") },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: colors.textSecondary }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Trigger Backup */}
          <div style={{ background: colors.blueDim, border: `1px solid ${colors.blue}`, borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <Zap size={28} color={colors.blue} style={{ marginBottom: 12 }} />
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={triggering || !canTrigger}
              title={canTrigger ? undefined : "Requires SysAdmin or BusinessOwner role"}
              style={{
                background: triggering || !canTrigger ? colors.bgCard : colors.blue,
                border: "none", borderRadius: 6, padding: "12px 20px",
                color: canTrigger ? "#fff" : colors.textSecondary, fontWeight: 700, fontSize: 13,
                cursor: triggering || !canTrigger ? "default" : "pointer",
                textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {triggering && <Spinner size={14} />}
              {triggering ? "Queuing…" : "Trigger Immediate Backup"}
            </button>
            <div style={{ fontSize: 11, color: colors.textSecondary }}>
              Manual override. Full snapshot will be queued for immediate processing.
            </div>
          </div>
        </div>

        {/* Metrics row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: colors.textSecondary, textTransform: "uppercase" }}>CPU Usage</span>
              <Cpu size={14} color={colors.textMuted} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: colorFor(cpuPct) }}>
              {metrics ? `${cpuPct.toFixed(1)}%` : "—"}
            </div>
            <MiniSparkline data={cpuHist.current} color={colorFor(cpuPct)} />
          </div>
          <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: colors.textSecondary, textTransform: "uppercase" }}>RAM Usage</span>
              <MemoryStick size={14} color={colors.textMuted} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: colorFor(ramPct) }}>
              {metrics ? formatBytes(metrics.mem_used_bytes) : "—"}
            </div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 2 }}>
              {metrics ? `${ramPct.toFixed(1)}% of ${formatBytes(metrics.mem_total_bytes)}` : ""}
            </div>
            <MiniSparkline data={ramHist.current} color={colorFor(ramPct)} />
          </div>
          <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: colors.textSecondary, textTransform: "uppercase" }}>Disk Capacity</span>
              <HardDrive size={14} color={colors.textMuted} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <DonutChart pct={diskPct} color={colorFor(diskPct)} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: colorFor(diskPct) }}>
                  {metrics ? `${diskPct.toFixed(0)}%` : "—"}
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>
                  {metrics ? `${formatBytes(metrics.disk_used_bytes)} / ${formatBytes(metrics.disk_total_bytes)} used` : "spool volume"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Log terminal */}
        {id && <LogTerminal nodeId={id} />}

        {/* Footer */}
        <div style={{ marginTop: 12, padding: "10px 0", borderTop: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", fontSize: 12, color: colors.textSecondary }}>
          <span>GLOBAL STATUS: {activeCount} Node{activeCount !== 1 ? "s" : ""} Active | {faultCount} Fault{faultCount !== 1 ? "s" : ""}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Lock size={12} />
            All connections to {id} are end-to-end encrypted.
          </span>
        </div>
      </div>

      {confirmOpen && (
        <ConfirmModal
          title="Trigger immediate backup?"
          message={
            <>
              This performs a manual override on <strong style={{ color: colors.textPrimary }}>{id}</strong>. A full
              snapshot will be extracted, encrypted, and queued for immediate processing outside the cron schedule.
            </>
          }
          confirmLabel="Trigger Backup"
          loading={triggering}
          onConfirm={confirmTrigger}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
