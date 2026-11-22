/**
 * FX Designer server: serves the built app and, when PostgreSQL is configured, the account
 * and library API under /api. Configuration: environment variables (.env.example).
 */
import { createServer, type IncomingMessage } from 'node:http';
import { Auth } from './auth.js';
import { applyDevOverrides, loadConfig } from './config.js';
import { createPool, migrate, type Db } from './db.js';
import {
  HttpError,
  parseCookies,
  Router,
  securityHeaders,
  sendJson,
  serveStatic,
  type Request,
} from './http.js';
import { communityRoutes } from './community.js';
import { libraryRoutes } from './library.js';

const devOverrides = applyDevOverrides(process.env, process.argv);
if (devOverrides.length) console.log(`[dev] using DEV_ settings for ${devOverrides.join(', ')}`);
const config = loadConfig();
const router = new Router();
/** Set once the database answered and is migrated (accounts on). */
let db: Db | null = null;

/** Where the server looks for the database (no password), for the logs. */
function databaseTarget(): string {
  const env = process.env;
  if (env.DATABASE_URL) {
    try {
      const u = new URL(env.DATABASE_URL);
      return `${u.username}@${u.hostname}:${u.port || 5432}${u.pathname} (DATABASE_URL)`;
    } catch {
      return 'DATABASE_URL (unparsable)';
    }
  }
  return `${env.PGUSER ?? '(no PGUSER)'}@${env.PGHOST}:${env.PGPORT ?? 5432}/${env.PGDATABASE ?? '(no PGDATABASE)'}`;
}

/**
 * Connects and migrates, retrying (the database container may start after this one, or be
 * unreachable): the app is served meanwhile, with accounts off. Every failure is logged with
 * its reason (wrong host / network, password, missing database…).
 */
async function connectDatabase(): Promise<void> {
  const pool = createPool();
  pool.on('error', (e) => console.error('[db] idle client error:', e.message));
  const target = databaseTarget();
  for (let attempt = 1; ; attempt++) {
    try {
      await migrate(pool);
      break;
    } catch (e) {
      const reason =
        e instanceof Error ? `${(e as { code?: string }).code ?? ''} ${e.message}` : String(e);
      const wait = Math.min(60, attempt * 5);
      console.error(`[db] cannot use ${target}: ${reason.trim()} · retrying in ${wait} s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
  }
  const auth = new Auth(pool, config);
  auth.routes(router);
  libraryRoutes(router, pool, auth);
  communityRoutes(router, pool, auth);
  setInterval(() => void auth.prune().catch((e: unknown) => console.error(e)), 3_600_000).unref();
  db = pool;
  console.log(`[db] connected to ${target}: accounts on`);
}

if (config.database) void connectDatabase();
else
  console.log(
    '[db] accounts off: neither DATABASE_URL nor PGHOST is set in the environment ' +
      '(see .env.example; `npm start` and `npm run dev:server` read ./.env)',
  );

router.add('GET', '/api/health', async (_req, res) => {
  let database = false;
  if (db)
    database = await db.query('SELECT 1').then(
      () => true,
      () => false,
    );
  sendJson(res, 200, {
    ok: true,
    accounts: database,
    discord: database && config.discord !== null,
    registration: config.registration,
  });
});

const publicOrigin = new URL(config.publicUrl).origin;

function clientIp(raw: IncomingMessage): string {
  const forwarded = raw.headers['x-forwarded-for'];
  if (config.trustProxy && typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return raw.socket.remoteAddress ?? 'unknown';
}

const server = createServer((raw, res) => {
  void (async () => {
    securityHeaders(res);
    const url = new URL(raw.url ?? '/', 'http://localhost');
    const method = raw.method ?? 'GET';
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (url.pathname === '/healthz') {
          res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok\n');
          return;
        }
        if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
        await serveStatic(config.staticDir, url.pathname, raw, res);
        return;
      }
      // Writes only from our own pages: other origins can't send JSON without a CORS
      // preflight (which we never answer), and a present Origin header must be ours.
      if (method !== 'GET' && method !== 'HEAD') {
        const origin = raw.headers.origin;
        if (origin && origin !== publicOrigin) throw new HttpError(403, 'Cross-origin request');
      }
      const match = router.match(method, url.pathname);
      if (!match) throw new HttpError(router.knows(url.pathname) ? 405 : 404, 'No such endpoint');
      const req: Request = {
        raw,
        method,
        path: url.pathname,
        query: url.searchParams,
        params: match.params,
        cookies: parseCookies(raw.headers.cookie),
        ip: clientIp(raw),
      };
      await match.handler(req, res);
    } catch (e) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (e instanceof HttpError) sendJson(res, e.status, { error: e.message });
      else {
        console.error(`[http] ${method} ${url.pathname}`, e);
        sendJson(res, 500, { error: 'Server error' });
      }
    }
  })();
});

server.listen(config.port, () => {
  console.log(
    `FX Designer on :${config.port} (${config.publicUrl})` +
      `${config.database ? ' · connecting to the database…' : ''}` +
      `${config.discord ? ' · Discord' : ''}`,
  );
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close();
    void db?.end();
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
