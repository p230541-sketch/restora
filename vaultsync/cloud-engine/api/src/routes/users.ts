import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { getPool } from "../db/pool";
import { requireRole, AuthedRequest, Role } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

const router = Router();

const ROLES: Role[] = ["SysAdmin", "BusinessOwner", "ReadOnly"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// All user-management endpoints are SysAdmin-only.
router.use(requireRole("SysAdmin"));

// GET /api/users
router.get("/", async (_req: AuthedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT id, email, name, role, created_at, last_login FROM users ORDER BY created_at"
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
router.post("/", async (req: AuthedRequest, res: Response) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const name = String(req.body?.name ?? "").trim();
  const password = String(req.body?.password ?? "");
  const role = req.body?.role as Role;

  if (!EMAIL_RE.test(email)) { res.status(400).json({ error: "Valid email required" }); return; }
  if (name.length < 2) { res.status(400).json({ error: "Name must be at least 2 characters" }); return; }
  if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
  if (!ROLES.includes(role)) { res.status(400).json({ error: "Invalid role" }); return; }

  try {
    const pool = getPool();
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4)
       RETURNING id, email, name, role, created_at, last_login`,
      [email, name, hash, role]
    );
    await recordAudit(req, "user.create", email, `Created ${role} user "${name}"`);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err.code === "23505") { res.status(409).json({ error: `Email "${email}" already exists` }); return; }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id  — update name / role / password
router.patch("/:id", async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const updates: string[] = [];
  const values: any[] = [];

  try {
    const pool = getPool();
    const existing = await pool.query("SELECT id, role FROM users WHERE id = $1", [id]);
    if (existing.rows.length === 0) { res.status(404).json({ error: "User not found" }); return; }

    if (typeof req.body?.name === "string") {
      const name = req.body.name.trim();
      if (name.length < 2) { res.status(400).json({ error: "Name must be at least 2 characters" }); return; }
      values.push(name); updates.push(`name = $${values.length}`);
    }

    if (typeof req.body?.role === "string") {
      const role = req.body.role as Role;
      if (!ROLES.includes(role)) { res.status(400).json({ error: "Invalid role" }); return; }
      // Guard: don't demote the last SysAdmin
      if (existing.rows[0].role === "SysAdmin" && role !== "SysAdmin") {
        const { rows } = await pool.query("SELECT count(*)::int AS n FROM users WHERE role = 'SysAdmin'");
        if (rows[0].n <= 1) { res.status(400).json({ error: "Cannot demote the last SysAdmin" }); return; }
      }
      values.push(role); updates.push(`role = $${values.length}`);
    }

    if (typeof req.body?.password === "string" && req.body.password.length > 0) {
      if (req.body.password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
      const hash = await bcrypt.hash(req.body.password, 10);
      values.push(hash); updates.push(`password_hash = $${values.length}`);
    }

    if (updates.length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${values.length}
       RETURNING id, email, name, role, created_at, last_login`,
      values
    );
    await recordAudit(req, "user.update", rows[0].email, `Updated fields: ${updates.map((u) => u.split(" =")[0]).join(", ")}`);
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id
router.delete("/:id", async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  if (id === req.user!.id) { res.status(400).json({ error: "You cannot delete your own account" }); return; }

  try {
    const pool = getPool();
    const target = await pool.query("SELECT role FROM users WHERE id = $1", [id]);
    if (target.rows.length === 0) { res.status(404).json({ error: "User not found" }); return; }

    if (target.rows[0].role === "SysAdmin") {
      const { rows } = await pool.query("SELECT count(*)::int AS n FROM users WHERE role = 'SysAdmin'");
      if (rows[0].n <= 1) { res.status(400).json({ error: "Cannot delete the last SysAdmin" }); return; }
    }

    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    await recordAudit(req, "user.delete", id, `Deleted ${target.rows[0].role} user`);
    res.json({ deleted: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
