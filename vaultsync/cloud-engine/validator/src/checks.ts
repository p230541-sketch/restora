import { Pool } from "pg";

export interface CheckResult {
  rowCounts: Record<string, number>;
  checksum: string;
}

// Runs COUNT(*) on every user table and builds a simple checksum from the counts.
export async function runIntegrityChecks(
  adminDsn: string,
  dbName: string
): Promise<CheckResult> {
  const url = new URL(adminDsn);
  url.pathname = `/${dbName}`;
  const pool = new Pool({ connectionString: url.toString() });

  try {
    // Discover user tables
    const tablesRes = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const tables = tablesRes.rows.map((r) => r.tablename);

    const rowCounts: Record<string, number> = {};
    const tableFingerprints: string[] = [];

    for (const table of tables) {
      const countRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM "${table}"`
      );
      rowCounts[table] = parseInt(countRes.rows[0].count, 10);

      // Content fingerprint: md5 each row's full text, aggregate order-independently,
      // then hash. This detects ANY cell change — not just row-count changes.
      const fpRes = await pool.query<{ fp: string }>(
        `SELECT md5(coalesce(string_agg(rh, '' ORDER BY rh), '')) AS fp
           FROM (SELECT md5(CAST(t AS text)) AS rh FROM "${table}" t) s`
      );
      tableFingerprints.push(`${table}:${fpRes.rows[0].fp}`);
    }

    // Overall checksum: sorted per-table fingerprints joined and hashed.
    const checksumInput = tableFingerprints.sort().join("|");
    const checksumRes = await pool.query<{ md5: string }>(
      `SELECT md5($1) AS md5`,
      [checksumInput]
    );
    const checksum = checksumRes.rows[0].md5;

    return { rowCounts, checksum };
  } finally {
    await pool.end();
  }
}
