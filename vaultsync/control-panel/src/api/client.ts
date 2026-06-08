import { MOCK_SETTINGS } from "./mockData";

const BASE = "/api";

export type Role = "SysAdmin" | "BusinessOwner" | "ReadOnly";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

// Auth is carried by an httpOnly cookie set on login — never read in JS (XSS-safe).
// Every request opts into sending it; mutations also echo the readable CSRF cookie.
const CREDENTIALS: RequestCredentials = "include";

function csrfHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const m = document.cookie.match(/(?:^|;\s*)vaultsync_csrf=([^;]+)/);
  return m ? { ...extra, "X-CSRF-Token": decodeURIComponent(m[1]) } : extra;
}

export interface BackupRecord {
  id: string;
  node_id: string;
  s3_key: string;
  status: "pass" | "fail" | "critical_failure" | "pending";
  row_counts: Record<string, number> | null;
  checksum: string | null;
  db_size_bytes: number | null;
  latency_ms: number | null;
  error_detail: string | null;
  created_at: string;
  validated_at: string | null;
}

export interface NodeRecord {
  node_id: string;
  ip_address: string;
  status: "connected" | "disconnected" | "node_disconnected";
  last_ping: string | null;
  created_at: string;
  backups_24h: string;
  last_backup_status: string | null;
  last_backup_at: string | null;
}

export interface NodeDetail {
  node: NodeRecord;
  recentBackups: BackupRecord[];
}

export interface KeyData {
  id: string;
  secretId: string;
  maskedKey: string;
  fullKey: string;
  rotateWarningDays: number;
}

export interface AppSettings {
  cron_schedule: string;
  retention_days: number;
  disk_threshold_pct: number;
  key_rotation_days: number;
  notify_on_failure: boolean;
  notify_on_success: boolean;
  alert_email: string | null;
  latency_sla_ms: number;
  key_rotated_at?: string;
  updated_at?: string;
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
  last_login: string | null;
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: string;
  node_id: string | null;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  created_at: string;
}

export interface NodeMetrics {
  cpu_percent: number;
  mem_used_bytes: number;
  mem_total_bytes: number;
  mem_percent: number;
  disk_used_bytes: number;
  disk_total_bytes: number;
  disk_percent: number;
  uptime_seconds: number;
}

// On failure, logs the error and returns a neutral fallback (empty/default) so
// the UI shows honest empty states — never fabricated "mock" data that looks real.
async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, { credentials: CREDENTIALS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    console.error(`[api] GET ${path} failed:`, err);
    return fallback;
  }
}

export const auth = {
  login: async (email: string, password: string): Promise<{ user: User }> => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: CREDENTIALS, // let the browser store the httpOnly cookie
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Login failed (HTTP ${res.status})`);
    return body;
  },
  me: async (): Promise<User> => {
    const res = await fetch(`${BASE}/auth/me`, { credentials: CREDENTIALS });
    if (!res.ok) throw new Error("Not authenticated");
    const body = await res.json();
    return body.user;
  },
  logout: async (): Promise<void> => {
    await fetch(`${BASE}/auth/logout`, { method: "POST", credentials: CREDENTIALS });
  },
};

export const api = {
  // Honest empty/null fallbacks — the UI shows real empty states on failure,
  // not fabricated data. (Was MOCK_BACKUPS/MOCK_NODES/MOCK_NODE_DETAIL.)
  getBackups: (days = 30) => get<BackupRecord[]>(`/backups?days=${days}`, []),
  getNodes: () => get<NodeRecord[]>("/nodes", []),
  getNode: (id: string) => get<NodeDetail | null>(`/nodes/${id}`, null),
  getNodeMetrics: (id: string) => get<NodeMetrics | null>(`/nodes/${id}/metrics`, null),
  triggerBackup: async (id: string): Promise<{ status: string }> => {
    const res = await fetch(`${BASE}/nodes/${id}/trigger`, { method: "POST", headers: csrfHeaders(), credentials: CREDENTIALS });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error ?? `Trigger failed (HTTP ${res.status})`);
    }
    return body;
  },
  // Throws on failure so a broken key fetch never displays a fake decryption key.
  getKey: async (id: string): Promise<KeyData> => {
    const res = await fetch(`${BASE}/keys/${id}`, { credentials: CREDENTIALS });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Key fetch failed (HTTP ${res.status})`);
    return body;
  },

  // Settings fall back to documented defaults (legitimate config, not fake data).
  getSettings: () => get<AppSettings>("/settings", MOCK_SETTINGS),

  updateSettings: async (patch: Partial<AppSettings>): Promise<AppSettings> => {
    const res = await fetch(`${BASE}/settings`, {
      method: "PUT",
      headers: csrfHeaders({ "Content-Type": "application/json" }),
      credentials: CREDENTIALS,
      body: JSON.stringify(patch),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Save failed (HTTP ${res.status})`);
    return body;
  },

  provisionNode: async (nodeId: string, ipAddress?: string): Promise<NodeRecord> => {
    const res = await fetch(`${BASE}/nodes`, {
      method: "POST",
      headers: csrfHeaders({ "Content-Type": "application/json" }),
      credentials: CREDENTIALS,
      body: JSON.stringify({ node_id: nodeId, ip_address: ipAddress || null }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Provision failed (HTTP ${res.status})`);
    return body;
  },

  listUsers: () => get<ManagedUser[]>("/users", []),

  createUser: async (payload: { email: string; name: string; password: string; role: Role }): Promise<ManagedUser> => {
    const res = await fetch(`${BASE}/users`, {
      method: "POST",
      headers: csrfHeaders({ "Content-Type": "application/json" }),
      credentials: CREDENTIALS,
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Create failed (HTTP ${res.status})`);
    return body;
  },

  updateUser: async (id: string, patch: { name?: string; role?: Role; password?: string }): Promise<ManagedUser> => {
    const res = await fetch(`${BASE}/users/${id}`, {
      method: "PATCH",
      headers: csrfHeaders({ "Content-Type": "application/json" }),
      credentials: CREDENTIALS,
      body: JSON.stringify(patch),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Update failed (HTTP ${res.status})`);
    return body;
  },

  deleteUser: async (id: string): Promise<void> => {
    const res = await fetch(`${BASE}/users/${id}`, { method: "DELETE", headers: csrfHeaders(), credentials: CREDENTIALS });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Delete failed (HTTP ${res.status})`);
    }
  },

  getAlerts: (limit = 50) => get<{ alerts: Alert[]; unread: number }>(`/alerts?limit=${limit}`, { alerts: [], unread: 0 }),

  ackAlert: async (id: string): Promise<void> => {
    await fetch(`${BASE}/alerts/${id}/ack`, { method: "POST", headers: csrfHeaders(), credentials: CREDENTIALS });
  },

  ackAllAlerts: async (): Promise<void> => {
    await fetch(`${BASE}/alerts/ack-all`, { method: "POST", headers: csrfHeaders(), credentials: CREDENTIALS });
  },

  getAudit: (limit = 200) => get<AuditEntry[]>(`/audit?limit=${limit}`, []),

  rotateKey: async (): Promise<{ rotated_at: string }> => {
    const res = await fetch(`${BASE}/keys/rotate`, { method: "POST", headers: csrfHeaders(), credentials: CREDENTIALS });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Rotation failed (HTTP ${res.status})`);
    return body;
  },
};
