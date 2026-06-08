import { Router, Request, Response } from "express";
import { getPool } from "../db/pool";

const router = Router();

// GET /api/backups?days=30
router.get("/", async (req: Request, res: Response) => {
  const days = Math.min(parseInt((req.query.days as string) ?? "30", 10), 90);
  const pool = getPool();
  const result = await pool.query(
    `SELECT
       b.id, b.node_id, b.s3_key, b.status,
       b.row_counts, b.checksum, b.db_size_bytes,
       b.latency_ms, b.error_detail,
       b.created_at, b.validated_at
     FROM backups b
     WHERE b.created_at >= now() - ($1 || ' days')::interval
     ORDER BY b.created_at DESC`,
    [days]
  );
  res.json(result.rows);
});

export default router;
