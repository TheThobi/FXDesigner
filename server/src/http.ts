import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants as zlib, gzip } from 'node:zlib';

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Request {
  readonly raw: IncomingMessage;
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly params: Readonly<Record<string, string>>;
  readonly cookies: Readonly<Record<string, string>>;
  readonly ip: string;
}

export type Handler = (req: Request, res: ServerResponse) => Promise<void> | void;

interface Route {
  readonly method: string;
  readonly pattern: RegExp;
  readonly keys: readonly string[];
  readonly handler: Handler;
}

/** Minimal router: `/api/things/:id` patterns, first match wins. */
export class Router {
  private readonly routes: Route[] = [];

  add(method: string, path: string, handler: Handler): void {
    const keys: string[] = [];
    const pattern = new RegExp(
      `^${path.replace(/:(\w+)/g, (_m, key: string) => {
        keys.push(key);
        return '([^/]+)';
      })}$`,
    );
    this.routes.push({ method, pattern, keys, handler });
  }

  match(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.pattern.exec(path);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]!)));
      return { handler: r.handler, params };
    }
    return null;
  }

  /** True when some route exists for `path` (any method): 405 rather than 404. */
  knows(path: string): boolean {
    return this.routes.some((r) => r.pattern.test(path));
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const key = part.slice(0, i).trim();
    try {
      out[key] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // Malformed cookie: ignored.
    }
  }
  return out;
}

export interface CookieOptions {
  readonly maxAge?: number;
  readonly secure: boolean;
  readonly httpOnly?: boolean;
}

export function serializeCookie(name: string, value: string, opts: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`);
  return parts.join('; ');
}

export function appendCookie(res: ServerResponse, cookie: string): void {
  const prev = res.getHeader('Set-Cookie');
  const list = Array.isArray(prev) ? prev : prev ? [String(prev)] : [];
  res.setHeader('Set-Cookie', [...list, cookie]);
}

/** Reads a JSON body of at most `limit` bytes (413 above). */
export async function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  const type = req.headers['content-type'] ?? '';
  if (!type.toLowerCase().startsWith('application/json'))
    throw new HttpError(415, 'Expected application/json');
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > limit) throw new HttpError(413, 'Request too large');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

export function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

/** Headers sent with every response (same as deploy/nginx.conf). */
export function securityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
}

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

/**
 * Serves the built app: fingerprinted /assets/ cached forever, index.html always revalidated,
 * unknown paths fall back to index.html (single-page app). Never leaves `root`.
 */
export async function serveStatic(
  root: string,
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const base = resolve(root);
  let file = resolve(join(base, normalize(decodeURIComponent(path))));
  if (file !== base && !file.startsWith(base + sep)) throw new HttpError(404, 'Not found');
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    file = join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }
  if (!info?.isFile()) {
    if (extname(path)) throw new HttpError(404, 'Not found');
    file = join(base, 'index.html');
    info = await stat(file).catch(() => null);
    if (!info?.isFile()) throw new HttpError(404, 'Not found');
  }
  const immutable = path.startsWith('/assets/');
  const ext = extname(file).toLowerCase();
  const headers: Record<string, string | number> = {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  };
  const encoding = COMPRESSIBLE.has(ext) ? acceptedEncoding(req) : null;
  if (encoding) {
    const body = await compressed(file, info.mtimeMs, encoding);
    res.writeHead(200, {
      ...headers,
      'Content-Encoding': encoding,
      'Content-Length': body.length,
      Vary: 'Accept-Encoding',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  }
  res.writeHead(200, {
    ...headers,
    'Content-Length': info.size,
    ...(COMPRESSIBLE.has(ext) ? { Vary: 'Accept-Encoding' } : {}),
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}

/** Text assets worth compressing (images and fonts already are). */
const COMPRESSIBLE = new Set([
  '.html',
  '.js',
  '.css',
  '.json',
  '.webmanifest',
  '.svg',
  '.txt',
  '.map',
  '.wasm',
]);

type Encoding = 'br' | 'gzip';

function acceptedEncoding(req: IncomingMessage): Encoding | null {
  const accept = String(req.headers['accept-encoding'] ?? '');
  if (/\bbr\b/.test(accept)) return 'br';
  if (/\bgzip\b/.test(accept)) return 'gzip';
  return null;
}

/** Compressed files, compressed once per version of the file (the build is small). */
const compressedCache = new Map<
  string,
  { readonly mtime: number; readonly body: Promise<Buffer> }
>();

function compressed(file: string, mtime: number, encoding: Encoding): Promise<Buffer> {
  const key = `${encoding}:${file}`;
  const cached = compressedCache.get(key);
  if (cached?.mtime === mtime) return cached.body;
  const body = readFile(file).then((raw) =>
    encoding === 'br'
      ? brotliAsync(raw, {
          params: {
            [zlib.BROTLI_PARAM_QUALITY]: 9,
            [zlib.BROTLI_PARAM_SIZE_HINT]: raw.length,
          },
        })
      : gzipAsync(raw, { level: 9 }),
  );
  compressedCache.set(key, { mtime, body });
  body.catch(() => compressedCache.delete(key));
  return body;
}
