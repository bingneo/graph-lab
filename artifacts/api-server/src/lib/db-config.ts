import pg from "pg";

type ParsedConnectionString = {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
};

export type ResolvedDbConfig = {
    connectionString?: string;
    host?: string;
    port: number;
    database?: string;
    user?: string;
    password?: string;
};

function parsePort(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function parseConnectionString(connectionString: string | undefined): ParsedConnectionString {
    if (!connectionString) return {};

    try {
        const url = new URL(connectionString);
        return {
            host: url.hostname || undefined,
            port: parsePort(url.port || undefined, 5432),
            database: url.pathname.replace(/^\//, "") || undefined,
            user: url.username ? decodeURIComponent(url.username) : undefined,
            password: url.password ? decodeURIComponent(url.password) : undefined,
        };
    } catch {
        return {};
    }
}

export function resolveDbConfig(): ResolvedDbConfig {
    const connectionString =
        process.env.DATABASE_URL?.trim() || process.env.EXT_DATABASE_URL?.trim() || undefined;
    const parsed = parseConnectionString(connectionString);

    return {
        connectionString,
        host: process.env.EXT_DB_HOST?.trim() || parsed.host,
        port: parsePort(process.env.EXT_DB_PORT, parsed.port ?? 5432),
        database: process.env.EXT_DB_NAME?.trim() || parsed.database,
        user: process.env.EXT_DB_USER?.trim() || parsed.user,
        password: process.env.EXT_DB_PASSWORD ?? parsed.password,
    };
}

export function buildPgClientConfig(
    ssl: pg.ClientConfig["ssl"],
    connectionTimeoutMillis = 8000,
): pg.ClientConfig {
    const config = resolveDbConfig();

    if (config.connectionString) {
        return {
            connectionString: config.connectionString,
            ssl,
            connectionTimeoutMillis,
        };
    }

    return {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl,
        connectionTimeoutMillis,
    };
}

export function listMissingDbEnv(): string[] {
    const config = resolveDbConfig();
    if (config.connectionString) return [];

    const missing: string[] = [];
    if (!config.host) missing.push("DATABASE_URL or EXT_DB_HOST");
    if (!config.database) missing.push("DATABASE_URL or EXT_DB_NAME");
    if (!config.user) missing.push("DATABASE_URL or EXT_DB_USER");
    if (!config.password) missing.push("DATABASE_URL or EXT_DB_PASSWORD");
    return missing;
}
