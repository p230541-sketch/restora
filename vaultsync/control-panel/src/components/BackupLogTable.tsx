import React, { useMemo, useState } from "react";
import { colors } from "../styles/theme";
import { StatusBadge } from "./StatusBadge";
import { BackupRecord } from "../api/client";
import { Download, Eye, X, ArrowUp, ArrowDown, Search } from "lucide-react";
import { useToast } from "./Toast";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { formatTimestamp, downloadFile } from "../lib/format";

interface Props {
  backups: BackupRecord[];
}

type StatusFilter = "all" | "pass" | "fail" | "pending";
type SortKey = "created_at" | "node_id" | "db_size_bytes" | "status";
type SortDir = "asc" | "desc";

const MAX_ROWS = 50;

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes >= 1e12) return (bytes / 1e12).toFixed(1) + " TB";
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  return bytes + " B";
}

const formatTs = (ts: string) => formatTimestamp(ts, "full");

function matchesStatus(b: BackupRecord, f: StatusFilter): boolean {
  if (f === "all") return true;
  if (f === "fail") return b.status === "fail" || b.status === "critical_failure";
  return b.status === f;
}

const th: React.CSSProperties = {
  padding: "10px 12px", fontSize: 12, fontWeight: 600,
  color: colors.textSecondary, textAlign: "left",
  borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "12px 12px", fontSize: 13, color: colors.textPrimary,
  borderBottom: `1px solid ${colors.borderMuted}`,
};
const control: React.CSSProperties = {
  background: "#010409", border: `1px solid ${colors.border}`, borderRadius: 6,
  padding: "7px 10px", color: colors.textPrimary, fontSize: 12, outline: "none",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 0", borderBottom: `1px solid ${colors.borderMuted}` }}>
      <span style={{ fontSize: 12, color: colors.textSecondary }}>{label}</span>
      <span style={{ fontSize: 12, color: colors.textPrimary, fontFamily: "monospace", textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

function BackupDetailsModal({ record, onClose }: { record: BackupRecord; onClose: () => void }) {
  useEscapeKey(onClose);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(1,4,9,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1400 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#161b22", border: `1px solid ${colors.border}`, borderRadius: 12, padding: 28, width: 520, maxWidth: "92vw", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: colors.textPrimary }}>Backup Record</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{record.node_id}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSecondary, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <div>
          <DetailRow label="Record ID" value={record.id} />
          <DetailRow label="S3 Key" value={record.s3_key} />
          <DetailRow label="Status" value={<StatusBadge status={record.status === "pass" ? "pass" : record.status === "pending" ? "pending" : "fail"} />} />
          <DetailRow label="DB Size" value={formatBytes(record.db_size_bytes)} />
          <DetailRow label="Checksum" value={record.checksum ?? "—"} />
          <DetailRow label="Latency" value={record.latency_ms != null ? `${record.latency_ms} ms` : "—"} />
          <DetailRow label="Created" value={formatTs(record.created_at)} />
          <DetailRow label="Validated" value={record.validated_at ? formatTs(record.validated_at) : "—"} />
          {record.error_detail && <DetailRow label="Error" value={<span style={{ color: colors.red }}>{record.error_detail}</span>} />}
        </div>
      </div>
    </div>
  );
}

const CSV_COLUMNS: (keyof BackupRecord)[] = [
  "created_at", "node_id", "status", "db_size_bytes", "checksum", "latency_ms", "s3_key", "validated_at", "error_detail",
];

function toCsv(rows: BackupRecord[]): string {
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = CSV_COLUMNS.join(",");
  const body = rows.map((r) => CSV_COLUMNS.map((c) => escape(r[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function BackupLogTable({ backups }: Props) {
  const toast = useToast();
  const [selected, setSelected] = useState<BackupRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [nodeFilter, setNodeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const nodeOptions = useMemo(
    () => Array.from(new Set(backups.map((b) => b.node_id))).sort(),
    [backups]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = backups.filter((b) => {
      if (!matchesStatus(b, statusFilter)) return false;
      if (nodeFilter !== "all" && b.node_id !== nodeFilter) return false;
      if (q) {
        const hay = `${b.node_id} ${b.s3_key} ${b.checksum ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (sortKey === "created_at") { av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime(); }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }, [backups, statusFilter, nodeFilter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "node_id" ? "asc" : "desc");
    }
  }

  function handleExport(kind: "csv" | "json") {
    if (filtered.length === 0) {
      toast.warning("Nothing to export with the current filters.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    if (kind === "csv") {
      downloadFile(`vaultsync-audit-${stamp}.csv`, toCsv(filtered), "text/csv");
    } else {
      downloadFile(`vaultsync-audit-${stamp}.json`, JSON.stringify(filtered, null, 2), "application/json");
    }
    toast.success(`Exported ${filtered.length} record${filtered.length !== 1 ? "s" : ""} as ${kind.toUpperCase()}.`);
  }

  function handleRowDownload(b: BackupRecord) {
    try {
      downloadFile(`backup-${b.node_id}-${b.id}.json`, JSON.stringify(b, null, 2), "application/json");
      toast.success("Backup manifest downloaded.");
    } catch {
      toast.error("Download failed. Please try again.");
    }
  }

  const SortHead = ({ label, k, style }: { label: string; k: SortKey; style?: React.CSSProperties }) => (
    <th style={{ ...th, ...style }}>
      <button
        onClick={() => toggleSort(k)}
        style={{ background: "none", border: "none", cursor: "pointer", color: sortKey === k ? colors.textPrimary : colors.textSecondary, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, padding: 0 }}
      >
        {label}
        {sortKey === k && (sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Recent Backup Logs</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => handleExport("csv")} style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "7px 12px", cursor: "pointer", color: colors.textSecondary, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Download size={13} /> CSV
          </button>
          <button onClick={() => handleExport("json")} style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "7px 12px", cursor: "pointer", color: colors.textSecondary, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Download size={13} /> JSON
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, ...control, padding: "0 10px" }}>
          <Search size={13} color={colors.textSecondary} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search node, key, checksum…"
            style={{ background: "none", border: "none", outline: "none", color: colors.textPrimary, fontSize: 12, padding: "7px 0", width: 200 }}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={control}>
          <option value="all">All statuses</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
          <option value="pending">Pending</option>
        </select>
        <select value={nodeFilter} onChange={(e) => setNodeFilter(e.target.value)} style={control}>
          <option value="all">All nodes</option>
          {nodeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize: 12, color: colors.textSecondary, marginLeft: "auto" }}>
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          {filtered.length > MAX_ROWS ? ` (showing ${MAX_ROWS})` : ""}
        </span>
      </div>

      <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <SortHead label="Timestamp" k="created_at" />
              <SortHead label="Node Name" k="node_id" />
              <SortHead label="DB Size" k="db_size_bytes" />
              <SortHead label="Checksum Status" k="status" />
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...td, textAlign: "center", color: colors.textSecondary, padding: 32 }}>
                  No backup records match the current filters.
                </td>
              </tr>
            ) : (
              filtered.slice(0, MAX_ROWS).map((b) => (
                <tr key={b.id} style={{ cursor: "default" }}>
                  <td style={{ ...td, color: colors.blue, fontFamily: "monospace" }}>{formatTs(b.created_at)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{b.node_id}</td>
                  <td style={td}>{formatBytes(b.db_size_bytes)}</td>
                  <td style={td}>
                    <StatusBadge status={b.status === "pass" ? "pass" : b.status === "pending" ? "pending" : "fail"} />
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button title="View details" onClick={() => setSelected(b)} style={{ background: colors.bgCardHover, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "4px 8px", cursor: "pointer", color: colors.textSecondary }}>
                        <Eye size={14} />
                      </button>
                      <button title="Download manifest" onClick={() => handleRowDownload(b)} style={{ background: colors.bgCardHover, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "4px 8px", cursor: "pointer", color: colors.textSecondary }}>
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && <BackupDetailsModal record={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
