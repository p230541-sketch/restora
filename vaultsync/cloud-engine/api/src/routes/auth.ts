import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getPool } from "../db/pool";
import { authenticate, signToken, AuthedRequest, Role } from "../middleware/auth";
import { recordAuditFor } from "../lib/audit";
import { AUTH_COOKIE, CSRF_COOKIE, authCookieOptions, csrfCookieOptions } from "../lib/cookies";

const router = Router();

const DEFAULT_USERS: { email: string; name: string; password: string; role: Role }[] = [
  { email: "admin@restora.io", name: "Sarah Chen", password: "RestoraAdmin!2026", role: "SysAdmin" },
  { email: "owner@restora.io", name: "Marcus Reid", password: "RestoraOwner!2026", role: "BusinessOwner" },
  { email: "viewer@restora.io", name: "Ava Patel", password: "RestoraViewer!2026", role: "ReadOnly" },
];

/** Seed default demo accounts the first time the users table is empty. */
export async function seedUsers() {
  const pool = getPool();
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM users");
  if (rows[0].n > 0) return;
  for (const u of DEFAULT_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      "INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING",
      [u.email, u.name, hash, u.role]
    );
  }
  console.log(`[auth] Seeded ${DEFAULT_USERS.length} default users`);
}

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT id, email, name, password_hash, role FROM users WHERE email = $1",
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    await pool.query("UPDATE users SET last_login = now() WHERE id = $1", [user.id]);
    const authUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    await recordAuditFor(authUser, "auth.login", user.email, "Signed in");

    const token = signToken(authUser);
    // httpOnly session cookie + readable CSRF token (double-submit pattern).
    res.cookie(AUTH_COOKIE, token, authCookieOptions);
    res.cookie(CSRF_COOKIE, randomBytes(24).toString("hex"), csrfCookieOptions);
    // `token` is also returned for non-browser API clients; browsers use the cookie.
    res.json({ user: authUser, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — validate the current session (cookie or token)
router.get("/me", authenticate, (req: AuthedRequest, res: Response) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout — clear the session + CSRF cookies
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.clearCookie(CSRF_COOKIE, { path: "/" });
  res.json({ ok: true });
});

export default router;
