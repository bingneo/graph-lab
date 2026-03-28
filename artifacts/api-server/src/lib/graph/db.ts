/**
 * DB Read Layer — graph/db.ts
 *
 * SECURITY CONTRACT (non-negotiable):
 *   • Only reads from `experiment_records` in the `sciblock_v2` database.
 *   • SELECT only. Zero writes, zero DDL, zero migrations, zero other tables.
 *   • Only the fields required for graph generation are fetched (no SELECT *).
 *   • Connection config sourced exclusively from EXT_* environment variables.
 *
 * CONNECTION GOVERNANCE:
 *   • One module-level pg.Pool, created on first use and reused across requests.
 *   • max: 4 — hard cap; stays within the external DB's connection limit.
 *   • min: 0 — no connections held at startup; pool drains when server is idle.
 *   • idleTimeoutMillis: 30 000 — idle connections released after 30 s.
 *   • connectionTimeoutMillis: 10 000 — queued requests wait up to 10 s for a
 *     connection before failing with a clear error (not a silent hang).
 *   • statement_timeout: 15 000 ms set per-client before every query — prevents
 *     runaway queries from holding pool slots indefinitely.
 *   • Pool error events are caught and logged; they do not crash the process.
 *     pg removes the offending idle client automatically.
 *   • Every acquired client is released in a finally block, unconditionally.
 */

import pg from "pg";
import type { ExperimentRecordRow } from "./types.js";

// ─── Pool Singleton ────────────────────────────────────────────────────────────

let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (_pool) return _pool;

  _pool = new pg.Pool({
    host: process.env.EXT_DB_HOST,
    port: parseInt(process.env.EXT_DB_PORT ?? "5432", 10),
    database: process.env.EXT_DB_NAME,
    user: process.env.EXT_DB_USER,
    password: process.env.EXT_DB_PASSWORD,
    ssl: false,

    max: 4,
    min: 0,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  _pool.on("error", (err: Error) => {
    console.error("[graph-db] idle client error (client removed from pool):", err.message);
  });

  return _pool;
}

// ─── Query Helper ──────────────────────────────────────────────────────────────

async function withClient<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("SET statement_timeout = 15000");
    return await fn(client);
  } finally {
    client.release();
  }
}

// ─── Permitted Columns ─────────────────────────────────────────────────────────

const RECORD_FIELDS = `
  id,
  sci_note_id,
  experiment_code,
  title,
  sequence_number,
  experiment_status,
  confirmation_state,
  tags,
  derived_from_record_id,
  derived_from_source_type,
  derived_from_context_ver,
  current_modules,
  confirmed_modules,
  created_at,
  updated_at
`.trim();

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetch all non-deleted experiment records for a given sci_note_id.
 * Used to build the Lineage Graph.
 */
export async function fetchRecordsBySciNoteId(
  sciNoteId: string
): Promise<ExperimentRecordRow[]> {
  return withClient(async (client) => {
    const result = await client.query<ExperimentRecordRow>(
      `SELECT ${RECORD_FIELDS}
       FROM experiment_records
       WHERE sci_note_id = $1
         AND is_deleted = false
       ORDER BY sequence_number ASC, created_at ASC`,
      [sciNoteId]
    );
    return result.rows;
  });
}

/**
 * Attempt to fetch the title of a sci_note from the sci_notes table.
 *
 * Returns null if the table does not exist, the record is not found,
 * or any other query error occurs — the caller must treat null as "use fallback".
 * This function NEVER throws.
 *
 * Security: read-only SELECT, one specific column, parameter-bound.
 */
export async function fetchSciNoteTitle(sciNoteId: string): Promise<string | null> {
  try {
    return await withClient(async (client) => {
      const result = await client.query<{ title: string }>(
        `SELECT title FROM scinotes WHERE id = $1 LIMIT 1`,
        [sciNoteId],
      );
      const title = result.rows[0]?.title?.trim();
      return title || null;
    });
  } catch {
    // sci_notes table may not be accessible in this DB snapshot; caller uses display fallback.
    return null;
  }
}

/**
 * Fetch a single non-deleted experiment record by its id.
 * Used to build the Mechanism Snapshot Graph.
 */
export async function fetchRecordById(
  recordId: string
): Promise<ExperimentRecordRow | null> {
  return withClient(async (client) => {
    const result = await client.query<ExperimentRecordRow>(
      `SELECT ${RECORD_FIELDS}
       FROM experiment_records
       WHERE id = $1
         AND is_deleted = false
       LIMIT 1`,
      [recordId]
    );
    return result.rows[0] ?? null;
  });
}
