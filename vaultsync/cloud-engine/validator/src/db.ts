import { Pool } from "pg";

// Shared telemetry-DB pool singleton. Previously inlined inside telemetry.ts.
// (The ephemeral validation DBs in importer.ts/checks.ts are intentionally
// separate short-lived pools and are not managed here.)
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.TELEMETRY_DB_DSN });
  }
  return pool;
}
