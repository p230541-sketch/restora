import { Router, Request, Response } from "express";
import { getPool } from "../db/pool";
import { requireRole } from "../middleware/auth";

const router = Router();

// GET /api/audit?limit=200 — recent audit entries (SysAdmin only)
router.get("/", requireRole("SysAdmin"), async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "200", 10), 500);
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, actor_id, actor_name, actor_role, action, target, detail, created_at
       FROM audit_log ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
