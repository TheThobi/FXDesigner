/**
 * FX Designer server: serves the built app and, when PostgreSQL is configured, the account
 * and library API under /api. Configuration: environment variables (.env.example).
 */
import { createServer, type IncomingMessage } from 'node:http';
import { Auth } from './auth.js';
import { loadConfig } from './config.js';
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
import { libraryRoutes } from './library.js';

const config = loadConfig();
const router = new Router();
let db: Db | null = null;

if (config.database) {
  db = createPool();
  await migrate(db);
  const auth = new Auth(db, config);
  auth.routes(router);
  libraryRoutes(router, db, auth);
  setInterval(() => void auth.prune().catch((e: unknown) => console.error(e)), 3_600_000).unref();
}

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
    `FX Designer on :${config.port} (${config.publicUrl}) · accounts ${db ? 'on' : 'off'}` +
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
