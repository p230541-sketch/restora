import { Router, Request, Response } from "express";
import { randomBytes } from "crypto";
import {
  GetSecretValueCommand,
  PutSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { requireRole, AuthedRequest } from "../middleware/auth";
import { getPool } from "../db/pool";
import { recordAudit } from "../lib/audit";
import { secretsClient } from "../lib/aws";

const router = Router();

// GET /api/keys/:id — reveals the emergency decryption key (SysAdmin only)
router.get("/:id", requireRole("SysAdmin"), async (req: Request, res: Response) => {
  try {
    const secretId = process.env.SECRET_ID ?? req.params.id;
    const cmd = new GetSecretValueCommand({ SecretId: secretId });
    const resp = await secretsClient.send(cmd);
    const key = resp.SecretString ?? "";
    // Return masked for display; include the real value so client can copy/download
    res.json({
      id: req.params.id,
      secretId,
      maskedKey: key.slice(0, 4) + "•".repeat(key.length - 8) + key.slice(-4),
      fullKey: key,
      rotateWarningDays: 12,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/keys/rotate — generate a new AES-256 key, store it, reset rotation clock (SysAdmin only)
router.post("/rotate", requireRole("SysAdmin"), async (req: AuthedRequest, res: Response) => {
  try {
    const secretId = process.env.SECRET_ID ?? "vaultsync/aes-key";
    const newKey = randomBytes(32).toString("hex"); // 256-bit key, hex-encoded
    await secretsClient.send(new PutSecretValueCommand({ SecretId: secretId, SecretString: newKey }));

    const pool = getPool();
    await pool.query(`UPDATE app_settings SET key_rotated_at = now() WHERE id = 1`);
    await pool.query(
      `INSERT INTO alerts (severity, type, message) VALUES ('info', 'key_rotated', $1)`,
      [`Encryption key rotated by ${req.user?.name ?? "SysAdmin"}. New backups use the new key.`]
    );

    await recordAudit(req, "key.rotate", secretId, "Rotated AES-256 encryption key");
    res.json({ rotated: true, rotated_at: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
