-- VaultSync telemetry database schema

CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Platform operators (Phase 2 auth/RBAC)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'ReadOnly',  -- SysAdmin | BusinessOwner | ReadOnly
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES clients(id) ON DELETE CASCADE,
  node_id     TEXT NOT NULL UNIQUE,   -- e.g. "us-east-prod-01"
  ip_address  TEXT,
  last_ping   TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'connected',  -- connected | disconnected | node_disconnected
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS backups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id       TEXT NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
  s3_key        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | pass | fail | critical_failure
  row_counts    JSONB,
  checksum      TEXT,
  db_size_bytes BIGINT,
  latency_ms    INTEGER,
  error_detail  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_backups_node_created ON backups (node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nodes_last_ping ON nodes (last_ping);

-- Operational alerts / notifications (Phase 3)
CREATE TABLE IF NOT EXISTS alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity      TEXT NOT NULL,          -- critical | warning | info
  type          TEXT NOT NULL,          -- backup_failure | backup_latency | node_stale | node_recovered | key_rotated | backup_success
  node_id       TEXT,
  message       TEXT NOT NULL,
  acknowledged  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts (created_at DESC);

-- Audit trail of privileged actions (Phase 3 hardening)
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID,
  actor_name  TEXT,
  actor_role  TEXT,
  action      TEXT NOT NULL,      -- e.g. key.rotate, user.create, settings.update, node.trigger, auth.login
  target      TEXT,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC);

-- Singleton platform configuration (id is pinned to 1)
CREATE TABLE IF NOT EXISTS app_settings (
  id                  INTEGER PRIMARY KEY DEFAULT 1,
  cron_schedule       TEXT NOT NULL DEFAULT '*/2 * * * *',
  retention_days      INTEGER NOT NULL DEFAULT 30,
  disk_threshold_pct  INTEGER NOT NULL DEFAULT 95,
  key_rotation_days   INTEGER NOT NULL DEFAULT 90,
  notify_on_failure   BOOLEAN NOT NULL DEFAULT true,
  notify_on_success   BOOLEAN NOT NULL DEFAULT false,
  alert_email         TEXT,
  latency_sla_ms      INTEGER NOT NULL DEFAULT 2500,
  key_rotated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Seed a default client + node so Phase 1 works without auth
INSERT INTO clients (id, name, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Client', 'demo@vaultsync.io')
ON CONFLICT DO NOTHING;

INSERT INTO nodes (client_id, node_id, ip_address, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'us-east-prod-01',
  '10.0.42.158',
  'connected'
) ON CONFLICT DO NOTHING;
