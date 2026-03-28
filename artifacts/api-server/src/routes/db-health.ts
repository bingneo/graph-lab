import { Router, type IRouter } from "express";
import pg from "pg";
import { buildPgClientConfig, listMissingDbEnv, resolveDbConfig } from "../lib/db-config.js";

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

  const config = resolveDbConfig();

  const msg = err.message ?? "";
  const code = (err as NodeJS.ErrnoException).code ?? "";

  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || msg.includes("getaddrinfo")) {
    return `DNS / host resolution failed: cannot resolve "${config.host ?? ""}". Check DATABASE_URL / EXT_DB_HOST.`;
  }
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "EHOSTUNREACH") {
    return `Port unreachable: cannot reach ${config.host ?? ""}:${config.port}. Check firewall or port.`;
  }
  if (msg.includes("password authentication failed") || msg.includes("authentication failed")) {
    return "Authentication failed: wrong username or password. Check DATABASE_URL / EXT_DB_USER / EXT_DB_PASSWORD.";
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
  return buildPgClientConfig(ssl ? { rejectUnauthorized: false } : false, 8000);
}

router.get("/db-health", async (_req, res) => {
  const checks: CheckResult[] = [];
  const config = resolveDbConfig();

  const response: DbHealthResponse = {
    connected: false,
    driver: "pg (node-postgres)",
    ssl: false,
    configuredHost: config.host ?? "(not set)",
    configuredPort: config.port,
    configuredDatabase: config.database ?? "(not set)",
    configuredUser: config.user ?? "(not set)",
    checks,
  };

  // Guard: require credentials
  const missing = listMissingDbEnv();
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

  await client.end().catch(() => { });

  res.status(200).json(response);
});

export default router;
