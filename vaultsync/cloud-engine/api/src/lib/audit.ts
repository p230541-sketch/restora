import { getPool } from "../db/pool";
import { AuthedRequest } from "../middleware/auth";

/** Append an entry to the audit trail. Best-effort — never throws into the request path. */
export async function recordAudit(
  req: AuthedRequest,
  action: string,
  target?: string,
  detail?: string
): Promise<void> {
  try {
    const u = req.user;
    await getPool().query(
      `INSERT INTO audit_log (actor_id, actor_name, actor_role, action, target, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [u?.id ?? null, u?.name ?? "system", u?.role ?? null, action, target ?? null, detail ?? null]
    );
  } catch (err: any) {
    console.error("[audit] failed to record:", err.message);
  }
}

/** Variant for actions where req.user is not yet populated (e.g. login). */
export async function recordAuditFor(
  actor: { id: string; name: string; role: string } | null,
  action: string,
  target?: string,
  detail?: string
): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO audit_log (actor_id, actor_name, actor_role, action, target, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actor?.id ?? null, actor?.name ?? "system", actor?.role ?? null, action, target ?? null, detail ?? null]
    );
  } catch (err: any) {
    console.error("[audit] failed to record:", err.message);
  }
}
