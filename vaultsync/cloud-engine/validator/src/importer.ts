import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { Pool } from "pg";

export interface ImportResult {
  dbName: string;
  adminPool: Pool;
}

// Creates an ephemeral DB, imports the SQL dump, returns the db name and admin pool.
export async function createEphemeralDb(
  adminDsn: string,
  sqlDump: Buffer
): Promise<ImportResult> {
  const dbName = `val_${randomUUID().replace(/-/g, "")}`;
  const adminPool = new Pool({ connectionString: adminDsn });

  await adminPool.query(`CREATE DATABASE "${dbName}"`);

  // Connection parameters for the new database
  const url = new URL(adminDsn);
  url.pathname = `/${dbName}`;

  // Import the dump via psql. Credentials are passed through PG* env vars rather
  // than embedded in a command-line DSN, so the password never appears in `ps`.
  try {
    execSync("psql", {
      input: sqlDump,
      env: {
        ...process.env,
        PGHOST: url.hostname,
        PGPORT: url.port || "5432",
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: dbName,
        PGSSLMODE: url.searchParams.get("sslmode") ?? "disable",
      },
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 60_000,
    });
  } catch (err: any) {
    // Try to clean up before re-throwing
    await dropEphemeralDb(adminPool, dbName);
    await adminPool.end();
    throw new Error(`psql import failed: ${err.stderr?.toString() ?? err.message}`);
  }

  return { dbName, adminPool };
}

export async function dropEphemeralDb(
  adminPool: Pool,
  dbName: string
): Promise<void> {
  try {
    // Terminate active connections first
    await adminPool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
      [dbName]
    );
    await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  } catch (err) {
    console.error(`[importer] Failed to drop ephemeral DB ${dbName}:`, err);
  }
}
