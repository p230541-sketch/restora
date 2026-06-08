// Single source of truth for value formatting across the UI.
// Previously these were re-implemented in NodeDetail, EdgeNodes, BackupLogTable,
// Alerts, Audit, Users, and TopBar with subtly different behaviour.

/** Human-readable byte size. Returns "—" for null/0. */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes >= 1e12) return (bytes / 1e12).toFixed(1) + " TB";
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + " KB";
  return bytes + " B";
}

/** Locale timestamp. Pass a preset to match the density a given table wants. */
export function formatTimestamp(ts: string, preset: "full" | "short" | "compact" = "full"): string {
  const opts: Intl.DateTimeFormatOptions =
    preset === "compact"
      ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }
      : preset === "short"
      ? { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }
      : { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
  return new Date(ts).toLocaleString("en-US", opts);
}

/** Relative "x ago" string. Returns "Never" for null. */
export function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "Never";
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Duration since a timestamp as "Dd Hh Mm". */
export function uptimeSince(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${d}d ${h}h ${m}m`;
}

/** Seconds → HH:MM:SS, or "—" for null. */
export function formatHMS(total: number | null): string {
  if (total == null) return "—";
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** Trigger a client-side file download from in-memory content. */
export function downloadFile(filename: string, content: BlobPart, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
