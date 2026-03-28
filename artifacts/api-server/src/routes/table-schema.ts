import { Router, type IRouter } from "express";
import pg from "pg";
import { buildPgClientConfig } from "../lib/db-config.js";

const router: IRouter = Router();

function buildClientConfig(): pg.ClientConfig {
  return buildPgClientConfig(false, 8000);
}

/**
 * GET /api/table-schema?table=<tablename>
 *
 * Returns column definitions and primary key info for the explicitly named table.
 * Only reads from information_schema — zero business data.
 * Only SELECT queries. No writes, no migrations, no DDL.
 */
router.get("/table-schema", async (req, res) => {
  const tableName = req.query.table;

  if (typeof tableName !== "string" || tableName.trim() === "") {
    res.status(400).json({
      error: "Missing required query parameter: ?table=<tablename>",
    });
    return;
  }

  const safeTable = tableName.trim();

  const client = new pg.Client(buildClientConfig());
  try {
    await client.connect();
  } catch (err) {
    res.status(503).json({ error: `Connection failed: ${(err as Error).message}` });
    return;
  }

  try {
    // Query 1: column definitions from information_schema (read-only system catalog)
    const columnsResult = await client.query<{
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
      ordinal_position: number;
    }>(
      `SELECT
         column_name,
         data_type,
         udt_name,
         is_nullable,
         column_default,
         ordinal_position
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
       ORDER BY ordinal_position`,
      [safeTable]
    );

    if (columnsResult.rows.length === 0) {
      res.status(404).json({
        error: `Table "${safeTable}" not found in schema "public", or the current user has no access to it.`,
      });
      await client.end().catch(() => { });
      return;
    }

    // Query 2: primary key columns (read-only system catalog)
    const pkResult = await client.query<{ column_name: string; constraint_name: string }>(
      `SELECT
         kcu.column_name,
         tc.constraint_name
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema   = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = 'public'
         AND tc.table_name = $1
       ORDER BY kcu.ordinal_position`,
      [safeTable]
    );

    const primaryKeys = pkResult.rows.map((r) => r.column_name);

    const columns = columnsResult.rows.map((col) => ({
      column_name: col.column_name,
      data_type: col.data_type === "USER-DEFINED" ? col.udt_name : col.data_type,
      is_nullable: col.is_nullable,
      column_default: col.column_default,
      is_primary_key: primaryKeys.includes(col.column_name),
    }));

    res.status(200).json({
      table: safeTable,
      schema: "public",
      column_count: columns.length,
      primary_keys: primaryKeys,
      columns,
      note: "Structure only — no business data was read.",
    });
  } catch (err) {
    res.status(500).json({ error: `Query failed: ${(err as Error).message}` });
  } finally {
    await client.end().catch(() => { });
  }
});

export default router;
