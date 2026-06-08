import { Router, Request, Response } from "express";
import { getPool } from "../db/pool";
import { requireRole, AuthedRequest } from "../middleware/auth";
import { applyLifecycle, getLifecycleDays } from "../jobs/lifecycle";
import { recordAudit } from "../lib/audit";

const router = Router();

// Columns the client is allowed to update, with validators.
const FIELDS: Record<string, (v: any) => boolean> = {
  cron_schedule: (v) =>
    typeof v === "string" && v.length <= 100 && v.trim().split(/\s+/).length === 5,
  retention_days: (v) => Number.isInteger(v) && v >= 1 && v <= 365,
  disk_threshold_pct: (v) => Number.isInteger(v) && v >= 50 && v <= 100,
  key_rotation_days: (v) => Number.isInteger(v) && v >= 1 && v <= 365,
  notify_on_failure: (v) => typeof v === "boolean",
  notify_on_success: (v) => typeof v === "boolean",
  alert_email: (v) => v === null || (typeof v === "string" && v.length <= 254),
  latency_sla_ms: (v) => Number.isInteger(v) && v >= 100 && v <= 600000,
};

async function loadSettings() {
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM app_settings WHERE id = 1`);
  return result.rows[0] ?? null;
}

// GET /api/settings
router.get("/", async (_req: Request, res: Response) => {
  try {
    const settings = await loadSettings();
    if (!settings) {
      res.status(404).json({ error: "Settings not initialized" });
      return;
    }
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — partial update of any allowed fields (SysAdmin only)
router.put("/", requireRole("SysAdmin"), async (req: AuthedRequest, res: Response) => {
  const body = req.body ?? {};
  const updates: string[] = [];
  const values: any[] = [];

  for (const [key, validate] of Object.entries(FIELDS)) {
    if (key in body) {
      if (!validate(body[key])) {
        res.status(400).json({ error: `Invalid value for "${key}"` });
        return;
      }
      values.push(body[key]);
      updates.push(`${key} = $${values.length}`);
    }
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE app_settings SET ${updates.join(", ")}, updated_at = now() WHERE id = 1 RETURNING *`,
      values
    );
    // Re-apply the S3 lifecycle when the retention window changes
    if ("retention_days" in body) {
      applyLifecycle(result.rows[0].retention_days).catch((e) =>
        console.error("[lifecycle] apply on update failed:", e.message)
      );
    }
    await recordAudit(req, "settings.update", "app_settings", `Changed: ${updates.map((u) => u.split(" =")[0]).join(", ")}`);
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/lifecycle — currently-applied S3 expiration window
router.get("/lifecycle", async (_req: Request, res: Response) => {
  const days = await getLifecycleDays();
  res.json({ days });
});

export default router;
