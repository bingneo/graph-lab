import { Router, type IRouter } from "express";
import pg from "pg";

const router: IRouter = Router();

interface CheckResult {
  step: string;
  ok: boolean;
  detail?: string;
  error?: string;
}

interface DbHealthResponse {
  connected: boolean;
  driver: string;
  ssl: boolean;
  configuredHost: string;
  configuredPort: number;
  configuredDatabase: string;
  configuredUser: string;
  serverEcho?: {
    currentDatabase: string;
    currentUser: string;
    serverTime: string;
    sslActive: boolean;
  };
  checks: CheckResult[];
  errorSummary?: string;
}

function classifyError(err: unknown): string {
  if (!(err instanceof Error)) return `Unknown error: ${String(err)}`;

  const msg = err.message ?? "";
  const code = (err as NodeJS.ErrnoException).code ?? "";

  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || msg.includes("getaddrinfo")) {
    return `DNS / host resolution failed: cannot resolve "${process.env.EXT_DB_HOST ?? ""}". Check EXT_DB_HOST.`;
  }
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "EHOSTUNREACH") {
    return `Port unreachable: cannot reach ${process.env.EXT_DB_HOST ?? ""}:${process.env.EXT_DB_PORT ?? "5432"}. Check firewall or port.`;
  }
  if (msg.includes("password authentication failed") || msg.includes("authentication failed")) {
    return `Authentication failed: wrong username or password. Check EXT_DB_USER / EXT_DB_PASSWORD.`;
  }
  if (msg.includes("SSL") || msg.includes("ssl") || msg.includes("TLS") || msg.includes("certificate")) {
    return `SSL / TLS error: ${msg}`;
  }
  if (msg.includes("permission denied") || msg.includes("pg_hba") || msg.includes("no pg_hba.conf entry")) {
    return `Connection rejected by server (pg_hba). Check host-based auth config and user privileges.`;
  }
  if (msg.includes("does not exist")) {
    return `Database not found or user has no access: ${msg}`;
  }
  return `Unexpected error: ${msg}`;
}

function buildClientConfig(ssl: boolean): pg.ClientConfig {
  const connectionString = process.env.EXT_DATABASE_URL;
  if (connectionString) {
    return {
      connectionString,
      ssl: ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 8000,
    };
  }
  return {
    host: process.env.EXT_DB_HOST,
    port: parseInt(process.env.EXT_DB_PORT ?? "5432", 10),
    database: process.env.EXT_DB_NAME,
    user: process.env.EXT_DB_USER,
    password: process.env.EXT_DB_PASSWORD,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
  };
}

router.get("/db-health", async (_req, res) => {
  const checks: CheckResult[] = [];

  const response: DbHealthResponse = {
    connected: false,
    driver: "pg (node-postgres)",
    ssl: false,
    configuredHost: process.env.EXT_DB_HOST ?? "(not set)",
    configuredPort: parseInt(process.env.EXT_DB_PORT ?? "5432", 10),
    configuredDatabase: process.env.EXT_DB_NAME ?? "(not set)",
    configuredUser: process.env.EXT_DB_USER ?? "(not set)",
    checks,
  };

  // Guard: require credentials
  const missing: string[] = [];
  if (!process.env.EXT_DATABASE_URL) {
    if (!process.env.EXT_DB_HOST) missing.push("EXT_DB_HOST");
    if (!process.env.EXT_DB_NAME) missing.push("EXT_DB_NAME");
    if (!process.env.EXT_DB_USER) missing.push("EXT_DB_USER");
    if (!process.env.EXT_DB_PASSWORD) missing.push("EXT_DB_PASSWORD");
  }
  if (missing.length > 0) {
    checks.push({
      step: "config-check",
      ok: false,
      error: `Missing required environment variables: ${missing.join(", ")}`,
    });
    res.status(500).json(response);
    return;
  }
  checks.push({ step: "config-check", ok: true, detail: "All required env vars present" });

  // Attempt connection: SSL first, then plain
  let client: pg.Client | null = null;
  let sslUsed = false;
  let connectError: unknown = null;

  for (const ssl of [true, false]) {
    const label = ssl ? "connect (SSL)" : "connect (no-SSL)";
    try {
      const c = new pg.Client(buildClientConfig(ssl));
      await c.connect();
      client = c;
      sslUsed = ssl;
      checks.push({ step: label, ok: true, detail: "TCP connection established" });
      break;
    } catch (err) {
      connectError = err;
      checks.push({ step: label, ok: false, error: classifyError(err) });
    }
  }

  if (!client) {
    response.errorSummary = classifyError(connectError);
    res.status(503).json(response);
    return;
  }

  response.connected = true;
  response.ssl = sslUsed;

  // Only these four read-only system queries are executed — nothing else
  try {
    const result = await client.query<{
      current_database: string;
      current_user: string;
      now: Date;
      ssl: boolean | null;
    }>(`
      SELECT
        current_database(),
        current_user,
        NOW(),
        (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS ssl
    `);
    const row = result.rows[0];
    response.serverEcho = {
      currentDatabase: row.current_database,
      currentUser: row.current_user,
      serverTime: row.now.toISOString(),
      sslActive: row.ssl === true,
    };
    checks.push({
      step: "server-echo",
      ok: true,
      detail: `db=${row.current_database}, user=${row.current_user}, time=${row.now.toISOString()}, ssl=${row.ssl ?? false}`,
    });
  } catch (err) {
    checks.push({ step: "server-echo", ok: false, error: classifyError(err) });
  }

  try {
    await client.query("SELECT 1");
    checks.push({ step: "SELECT 1", ok: true, detail: "Minimal read query passed" });
  } catch (err) {
    checks.push({ step: "SELECT 1", ok: false, error: classifyError(err) });
  }

  await client.end().catch(() => {});

  res.status(200).json(response);
});

export default router;
