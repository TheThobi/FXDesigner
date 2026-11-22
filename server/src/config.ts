/**
 * Server configuration, from environment variables (see .env.example). Nothing secret has a
 * default: without database settings the server only serves the static app (accounts off).
 */
export interface Config {
  readonly port: number;
  /** Public origin of the site (https://fx.example.com): cookies, OAuth redirects, CSRF. */
  readonly publicUrl: string;
  /** Built app (vite build output). */
  readonly staticDir: string;
  /** Accounts and library sync need PostgreSQL. */
  readonly database: boolean;
  readonly discord: { readonly clientId: string; readonly clientSecret: string } | null;
  /** Behind a reverse proxy: client IPs come from X-Forwarded-For (rate limiting). */
  readonly trustProxy: boolean;
  /** New email / password accounts allowed. */
  readonly registration: boolean;
}

/** Variables replaced in local development (`npm run dev:server`) by their `DEV_` version. */
const DEV_OVERRIDES = [
  'DATABASE_URL',
  'PGHOST',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
  'PUBLIC_URL',
] as const;

/**
 * Local development (`--dev`, set by `npm run dev:server`): the same .env serves both the
 * server and your machine. `DEV_PGHOST=localhost`, `DEV_PGPORT=5433`… replace the container
 * settings (the database container's name means nothing outside Docker), and PUBLIC_URL
 * becomes the Vite dev server (requests come from it). Returns the variables that changed.
 */
export function applyDevOverrides(env: NodeJS.ProcessEnv, argv: readonly string[]): string[] {
  if (!argv.includes('--dev') && env.FXD_DEV !== '1') return [];
  const changed: string[] = [];
  for (const key of DEV_OVERRIDES) {
    const value = env[`DEV_${key}`];
    if (value === undefined || value === '') continue;
    env[key] = value;
    changed.push(key);
  }
  if (!env.DEV_PUBLIC_URL) {
    env.PUBLIC_URL = 'http://localhost:5173';
    changed.push('PUBLIC_URL');
  }
  // A DATABASE_URL from the deployment would win over the local PG* settings.
  if (!env.DEV_DATABASE_URL && changed.some((k) => k.startsWith('PG'))) delete env.DATABASE_URL;
  return changed;
}

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`Invalid PORT: ${env.PORT}`);
  const publicUrl = (env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/+$/, '');
  try {
    new URL(publicUrl);
  } catch {
    throw new Error(`Invalid PUBLIC_URL: ${publicUrl}`);
  }
  // pg reads DATABASE_URL here, or the standard PGHOST / PGUSER / PGPASSWORD / PGDATABASE.
  const database = Boolean(env.DATABASE_URL || env.PGHOST);
  const discord =
    env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET
      ? { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET }
      : null;
  return {
    port,
    publicUrl,
    staticDir: env.STATIC_DIR ?? 'dist',
    database,
    discord,
    trustProxy: flag(env.TRUST_PROXY, false),
    registration: flag(env.ALLOW_REGISTRATION, true),
  };
}
