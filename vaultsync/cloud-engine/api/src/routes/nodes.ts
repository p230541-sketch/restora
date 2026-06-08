import { Router, Request, Response } from "express";
import { getPool } from "../db/pool";
import { requireRole, AuthedRequest } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import http from "http";

const router = Router();

const DEMO_CLIENT_ID = "00000000-0000-0000-0000-000000000001";
const NODE_ID_RE = /^[a-z0-9][a-z0-9-]{1,62}$/i;

// POST /api/nodes — provision/register a new edge node (SysAdmin only)
router.post("/", requireRole("SysAdmin"), async (req: Request, res: Response) => {
  const nodeId = String(req.body?.node_id ?? "").trim();
  const ipAddress = req.body?.ip_address ? String(req.body.ip_address).trim() : null;

  if (!NODE_ID_RE.test(nodeId)) {
    res.status(400).json({ error: "node_id must be 2-63 chars: letters, digits, hyphens" });
    return;
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO nodes (client_id, node_id, ip_address, status)
       VALUES ($1, $2, $3, 'connected')
       RETURNING node_id, ip_address, status, last_ping, created_at`,
      [DEMO_CLIENT_ID, nodeId, ipAddress]
    );
    await recordAudit(req as AuthedRequest, "node.provision", nodeId, `Provisioned node ${nodeId}`);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: `Node "${nodeId}" already exists` });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nodes
router.get("/", async (_req: Request, res: Response) => {
  const pool = getPool();
  const result = await pool.query(
    `SELECT
       n.node_id, n.ip_address, n.status, n.last_ping, n.created_at,
       (SELECT COUNT(*) FROM backups b WHERE b.node_id = n.node_id
          AND b.created_at >= now() - interval '24 hours') AS backups_24h,
       (SELECT status FROM backups b WHERE b.node_id = n.node_id
          ORDER BY created_at DESC LIMIT 1) AS last_backup_status,
       (SELECT created_at FROM backups b WHERE b.node_id = n.node_id
          ORDER BY created_at DESC LIMIT 1) AS last_backup_at
     FROM nodes n
     ORDER BY n.node_id`
  );
  res.json(result.rows);
});

// GET /api/nodes/:id
router.get("/:id", async (req: Request, res: Response) => {
  const pool = getPool();
  const nodeRes = await pool.query(
    `SELECT node_id, ip_address, status, last_ping, created_at FROM nodes WHERE node_id = $1`,
    [req.params.id]
  );
  if (nodeRes.rows.length === 0) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  const backupsRes = await pool.query(
    `SELECT id, s3_key, status, db_size_bytes, latency_ms, created_at, validated_at
     FROM backups WHERE node_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [req.params.id]
  );
  res.json({ node: nodeRes.rows[0], recentBackups: backupsRes.rows });
});

// GET /api/nodes/:id/logs  — SSE stream from edge daemon
router.get("/:id/logs", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const edgeNodeUrl = process.env.EDGE_NODE_URL ?? "http://edge-node:9100";
  const url = new URL(`${edgeNodeUrl}/logs`);

  const proxyReq = http.get(url, (proxyRes) => {
    proxyRes.on("data", (chunk: Buffer) => {
      res.write(chunk);
    });
    proxyRes.on("end", () => res.end());
  });
  proxyReq.on("error", () => {
    // If daemon not reachable, send a synthetic SSE message and close
    res.write(
      `data: ${JSON.stringify({ ts: new Date().toISOString(), level: "WARN", msg: "Daemon not reachable" })}\n\n`
    );
    res.end();
  });

  req.on("close", () => proxyReq.destroy());
});

// GET /api/nodes/:id/metrics — live host metrics proxied from the edge daemon
router.get("/:id/metrics", (_req: Request, res: Response) => {
  const edgeNodeUrl = process.env.EDGE_NODE_URL ?? "http://edge-node:9100";
  const proxyReq = http.get(`${edgeNodeUrl}/metrics`, (proxyRes) => {
    let body = "";
    proxyRes.on("data", (c) => (body += c));
    proxyRes.on("end", () => {
      res.status(proxyRes.statusCode ?? 200).type("application/json").send(body || "{}");
    });
  });
  proxyReq.on("error", (err) => {
    res.status(502).json({ error: `Daemon unreachable: ${err.message}` });
  });
});

// POST /api/nodes/:id/trigger — FR-10 manual backup (SysAdmin or BusinessOwner)
router.post("/:id/trigger", requireRole("SysAdmin", "BusinessOwner"), async (req: Request, res: Response) => {
  await recordAudit(req as AuthedRequest, "node.trigger", req.params.id, `Manual backup triggered for ${req.params.id}`);
  const edgeNodeUrl = process.env.EDGE_NODE_URL ?? "http://edge-node:9100";
  const url = new URL(`${edgeNodeUrl}/trigger`);

  const proxyReq = http.request(
    { hostname: url.hostname, port: url.port, path: url.pathname, method: "POST",
      headers: { "Content-Type": "application/json" } },
    (proxyRes) => {
      let body = "";
      proxyRes.on("data", (c) => (body += c));
      proxyRes.on("end", () => {
        res.status(proxyRes.statusCode ?? 200).json(
          body ? JSON.parse(body) : { status: "triggered" }
        );
      });
    }
  );
  proxyReq.on("error", (err) => {
    res.status(502).json({ error: `Daemon unreachable: ${err.message}` });
  });
  proxyReq.write(JSON.stringify({ source: "dashboard", nodeId: req.params.id }));
  proxyReq.end();
});

export default router;
