import { BackupRecord, NodeRecord, NodeDetail, KeyData, AppSettings } from "./client";

function daysAgo(d: number, h = 0): string {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(h, Math.floor(Math.random() * 60), 0, 0);
  return dt.toISOString();
}

const NODES: NodeRecord[] = [
  {
    node_id: "us-east-prod-01",
    ip_address: "10.0.42.158",
    status: "connected",
    last_ping: new Date(Date.now() - 24000).toISOString(),
    created_at: daysAgo(152),
    backups_24h: "3",
    last_backup_status: "pass",
    last_backup_at: daysAgo(0, 14),
  },
  {
    node_id: "eu-west-relay-04",
    ip_address: "10.2.14.91",
    status: "disconnected",
    last_ping: daysAgo(0, 8),
    created_at: daysAgo(90),
    backups_24h: "0",
    last_backup_status: "critical_failure",
    last_backup_at: daysAgo(1, 6),
  },
  {
    node_id: "ap-south-node-02",
    ip_address: "10.4.8.33",
    status: "connected",
    last_ping: new Date(Date.now() - 60000).toISOString(),
    created_at: daysAgo(60),
    backups_24h: "2",
    last_backup_status: "pass",
    last_backup_at: daysAgo(0, 12),
  },
];

const statuses: BackupRecord["status"][] = ["pass", "pass", "pass", "pass", "fail", "pass", "pass", "critical_failure", "pass", "pass"];

export const MOCK_BACKUPS: BackupRecord[] = Array.from({ length: 40 }, (_, i) => ({
  id: `mock-${i}`,
  node_id: NODES[i % NODES.length].node_id,
  s3_key: `backups/${NODES[i % NODES.length].node_id}/backup_${i}.enc`,
  status: statuses[i % statuses.length],
  row_counts: { products: 5, customers: 3, orders: 4 },
  checksum: `a1b2c3d4e5f6${i.toString().padStart(2, "0")}`,
  db_size_bytes: (1.1 + (i % 5) * 0.3) * 1e12,
  latency_ms: 8000 + (i % 10) * 1200,
  error_detail: statuses[i % statuses.length] !== "pass" ? "Checksum mismatch on table orders" : null,
  created_at: daysAgo(Math.floor(i / 2), 14 - (i % 12)),
  validated_at: daysAgo(Math.floor(i / 2), 14 - (i % 12) + 1),
}));

export const MOCK_NODES = NODES;

export const MOCK_NODE_DETAIL: NodeDetail = {
  node: NODES[0],
  recentBackups: MOCK_BACKUPS.filter((b) => b.node_id === "us-east-prod-01").slice(0, 5),
};

export const MOCK_SETTINGS: AppSettings = {
  cron_schedule: "*/2 * * * *",
  retention_days: 30,
  disk_threshold_pct: 95,
  key_rotation_days: 90,
  notify_on_failure: true,
  notify_on_success: false,
  alert_email: "ops@vaultsync.io",
  latency_sla_ms: 2500,
  key_rotated_at: new Date(Date.now() - 78 * 86400000).toISOString(),
  updated_at: new Date().toISOString(),
};

export const MOCK_KEY: KeyData = {
  id: "VS-SYNC-PRIMARY-ALPHA-01",
  secretId: "vaultsync/aes-key",
  maskedKey: "a1b2•••••••••••••••••••••••••••••••••••••••••••••••••••••c3d4",
  fullKey: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  rotateWarningDays: 12,
};
