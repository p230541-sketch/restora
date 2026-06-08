import { Router, Request, Response } from "express";
import { getPool } from "../db/pool";

const router = Router();

// GET /api/alerts?limit=50 — recent alerts + unread count
router.get("/", async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10), 200);
  try {
    const pool = getPool();
    const list = await pool.query(
      `SELECT id, severity, type, node_id, message, acknowledged, created_at
       FROM alerts ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    const unread = await pool.query(`SELECT count(*)::int AS n FROM alerts WHERE acknowledged = false`);
    res.json({ alerts: list.rows, unread: unread.rows[0].n });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/:id/ack — acknowledge one
router.post("/:id/ack", async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const r = await pool.query(
      `UPDATE alerts SET acknowledged = true WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (r.rows.length === 0) { res.status(404).json({ error: "Alert not found" }); return; }
    res.json({ acknowledged: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/ack-all — acknowledge everything unread
router.post("/ack-all", async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const r = await pool.query(`UPDATE alerts SET acknowledged = true WHERE acknowledged = false`);
    res.json({ acknowledged: r.rowCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
