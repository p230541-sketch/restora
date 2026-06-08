import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import backupsRouter from "./routes/backups";
import nodesRouter from "./routes/nodes";
import keysRouter from "./routes/keys";
import settingsRouter from "./routes/settings";
import usersRouter from "./routes/users";
import alertsRouter from "./routes/alerts";
import auditRouter from "./routes/audit";
import authRouter, { seedUsers } from "./routes/auth";
import { authenticate } from "./middleware/auth";
import { csrfProtection } from "./middleware/csrf";
import { errorMiddleware } from "./lib/http";
import { startStaleSweep } from "./jobs/staleSweep";
import { applyLifecycle } from "./jobs/lifecycle";
import { getPool } from "./db/pool";

// ── Fail-closed production config check ─────────────────────────────────────
const DEFAULT_JWT = "vaultsync-dev-secret-change-me";
function assertProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const fatal: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT) {
    fatal.push("JWT_SECRET is unset or the dev default");
  }
  if ((process.env.TELEMETRY_DB_DSN ?? "").includes(":secret@")) {
    fatal.push("Postgres password is the dev default ('secret')");
  }
  if (fatal.length) {
    console.error("[fatal] Insecure production config:\n  - " + fatal.join("\n  - ") + "\nRefusing to start.");
    process.exit(1);
  }
  if (process.env.AWS_ENDPOINT_URL) {
    console.warn("[warn] AWS_ENDPOINT_URL is set in production — still using a non-AWS endpoint (LocalStack?).");
  }
}
assertProductionConfig();

const app = express();
app.set("trust proxy", 1); // behind the nginx proxy — honour X-Forwarded-For for rate limiting
app.use(helmet());
app.use(cors({ origin: true, credentials: true })); // allow credentialed (cookie) requests
app.use(cookieParser());
app.use(express.json());

// Structured access log (skips health/readiness probe noise).
app.use((req, res, next) => {
  if (req.path === "/health" || req.path === "/ready") return next();
  const start = Date.now();
  res.on("finish", () => {
    console.log(JSON.stringify({
      ts: new Date().toISOString(), method: req.method, path: req.path,
      status: res.statusCode, ms: Date.now() - start,
    }));
  });
  next();
});

// Liveness: the process is up. Readiness: dependencies (DB) are reachable.
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/ready", async (_req, res) => {
  try {
    await getPool().query("SELECT 1");
    res.json({ status: "ready" });
  } catch (err: any) {
    res.status(503).json({ status: "not_ready", error: err.message });
  }
});

// Throttle brute-force login: only failed attempts count toward the limit.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many failed login attempts. Try again later." },
});

// Public auth endpoints (login is open; /me self-authenticates)
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", authRouter);

// Everything below requires a valid session, and CSRF protection on mutations.
app.use("/api", authenticate);
app.use("/api", csrfProtection);
app.use("/api/backups", backupsRouter);
app.use("/api/nodes", nodesRouter);
app.use("/api/keys", keysRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/users", usersRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/audit", auditRouter);

// Terminal error handler — must be registered after all routes.
app.use(errorMiddleware);

const port = parseInt(process.env.API_PORT ?? "3001", 10);
const server = app.listen(port, () => {
  console.log(`[api] VaultSync API listening on :${port}`);
  seedUsers().catch((err) => console.error("[auth] user seed failed:", err.message));
  startStaleSweep();
  initLifecycle();
});

// Graceful shutdown: stop accepting connections, drain the pool, then exit.
function shutdown(signal: string) {
  console.log(`[api] ${signal} received — shutting down gracefully…`);
  server.close(async () => {
    try { await getPool().end(); } catch { /* ignore */ }
    process.exit(0);
  });
  // Hard cap so a stuck connection can't block forever.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Apply the S3 retention lifecycle from current settings (best-effort; bucket may not be ready at boot).
async function initLifecycle(retriesLeft = 5) {
  try {
    const { rows } = await getPool().query(`SELECT retention_days FROM app_settings WHERE id = 1`);
    if (rows[0]) await applyLifecycle(rows[0].retention_days);
  } catch (err: any) {
    if (retriesLeft > 0) {
      setTimeout(() => initLifecycle(retriesLeft - 1), 5000);
    } else {
      console.error("[lifecycle] could not apply on startup:", err.message);
    }
  }
}

export default app;
