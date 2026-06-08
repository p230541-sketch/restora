import { getPool } from "./db";

export type BackupStatus = "pass" | "fail" | "critical_failure";

export interface TelemetryRecord {
  nodeId: string;
  s3Key: string;
  status: BackupStatus;
  rowCounts?: Record<string, number>;
  checksum?: string;
  dbSizeBytes?: number;
  latencyMs?: number;
  errorDetail?: string;
  validatedAt: Date;
}

export async function writeTelemetry(record: TelemetryRecord): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO backups
       (node_id, s3_key, status, row_counts, checksum, db_size_bytes, latency_ms, error_detail, validated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      record.nodeId,
      record.s3Key,
      record.status,
      record.rowCounts ? JSON.stringify(record.rowCounts) : null,
      record.checksum ?? null,
      record.dbSizeBytes ?? null,
      record.latencyMs ?? null,
      record.errorDetail ?? null,
      record.validatedAt,
    ]
  );
}

export type AlertSeverity = "critical" | "warning" | "info";

export async function insertAlert(
  severity: AlertSeverity,
  type: string,
  message: string,
  nodeId?: string
): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO alerts (severity, type, node_id, message) VALUES ($1, $2, $3, $4)`,
    [severity, type, nodeId ?? null, message]
  );
}

export interface NotifyPrefs {
  notifyOnFailure: boolean;
  notifyOnSuccess: boolean;
  latencySlaMs: number;
  alertEmail: string | null;
}

export async function getNotifyPrefs(): Promise<NotifyPrefs> {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT notify_on_failure, notify_on_success, latency_sla_ms, alert_email FROM app_settings WHERE id = 1`
  );
  const r = rows[0] ?? {};
  return {
    notifyOnFailure: r.notify_on_failure ?? true,
    notifyOnSuccess: r.notify_on_success ?? false,
    latencySlaMs: r.latency_sla_ms ?? 2500,
    alertEmail: r.alert_email ?? null,
  };
}

// Update the node's last_ping timestamp; raise a recovery alert if it had been stale.
export async function updateNodePing(nodeId: string): Promise<void> {
  const db = getPool();
  const prev = await db.query(`SELECT status FROM nodes WHERE node_id = $1`, [nodeId]);
  await db.query(
    `UPDATE nodes SET last_ping = now(), status = 'connected' WHERE node_id = $1`,
    [nodeId]
  );
  if (prev.rows[0] && prev.rows[0].status !== "connected") {
    await insertAlert("info", "node_recovered", `Node ${nodeId} reconnected and resumed reporting.`, nodeId).catch(() => {});
  }
}
