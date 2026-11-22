import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

function scryptAsync(
  password: string,
  salt: Buffer,
  length: number,
  opts: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, length, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** scrypt parameters (OWASP: N = 2^15, r = 8, p = 1); stored with each hash. */
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const MAXMEM = 64 * 1024 * 1024;

/** `scrypt$N$r$p$salt$hash` (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAXMEM });
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scryptAsync(password, Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A hash to compare against when the account doesn't exist (same timing as a real check). */
let dummy: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString('hex'));
  return dummy;
}

/** Random opaque token (session, OAuth state). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Tokens are stored hashed: a database leak doesn't give away live sessions. */
export function tokenHash(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---- Validation -------------------------------------------------------------------------

export const PSEUDO_RE = /^[A-Za-z0-9_.-]{3,24}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;

export function validPseudo(v: unknown): v is string {
  return typeof v === 'string' && PSEUDO_RE.test(v);
}

export function validEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v);
}

export function validPassword(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 8 && v.length <= 200;
}

/** A pseudo derived from a Discord name: allowed characters, 3–24 long. */
export function pseudoFrom(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9_.-]+/g, '').slice(0, 20);
  return clean.length >= 3 ? clean : `user${clean}`.slice(0, 20).padEnd(3, '0');
}

// ---- Rate limiting --------------------------------------------------------------------------

/** Fixed-window counter per key (in memory: one server instance). */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; reset: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Counts one attempt; false when the key is over the limit. */
  take(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    if (!h || h.reset <= now) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs });
      if (this.hits.size > 10_000) this.prune(now);
      return true;
    }
    h.count++;
    return h.count <= this.max;
  }

  private prune(now: number): void {
    for (const [k, h] of this.hits) if (h.reset <= now) this.hits.delete(k);
  }
}
