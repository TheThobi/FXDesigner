import { describe, expect, it } from 'vitest';
import { applyDevOverrides, loadConfig } from '../../server/src/config';
import { parseCookies, Router, serializeCookie } from '../../server/src/http';
import {
  hashPassword,
  pseudoFrom,
  RateLimiter,
  validEmail,
  validPassword,
  validPseudo,
  verifyPassword,
} from '../../server/src/security';

describe('passwords', () => {
  it('hashes with a salt and verifies', async () => {
    const a = await hashPassword('correct horse');
    const b = await hashPassword('correct horse');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse', a)).toBe(true);
    expect(await verifyPassword('wrong horse', a)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});

describe('validation', () => {
  it('checks pseudos, emails and passwords', () => {
    expect(validPseudo('thobi_fx')).toBe(true);
    expect(validPseudo('ab')).toBe(false);
    expect(validPseudo('has space')).toBe(false);
    expect(validEmail('a@b.co')).toBe(true);
    expect(validEmail('nope')).toBe(false);
    expect(validPassword('1234567')).toBe(false);
    expect(validPassword('12345678')).toBe(true);
  });

  it('derives valid pseudos from Discord names', () => {
    expect(validPseudo(pseudoFrom('Thobi ✨ FX'))).toBe(true);
    expect(validPseudo(pseudoFrom('✨'))).toBe(true);
  });
});

describe('http helpers', () => {
  it('routes with parameters', () => {
    const r = new Router();
    r.add('PUT', '/api/library/systems/:id', () => undefined);
    expect(r.match('PUT', '/api/library/systems/abc')?.params).toEqual({ id: 'abc' });
    expect(r.match('GET', '/api/library/systems/abc')).toBeNull();
    expect(r.knows('/api/library/systems/abc')).toBe(true);
  });

  it('parses and writes cookies', () => {
    expect(parseCookies('a=1; fxd_session=x%20y; bad')).toEqual({ a: '1', fxd_session: 'x y' });
    const c = serializeCookie('s', 'v', { secure: true, maxAge: 60 });
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Secure');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Max-Age=60');
  });
});

describe('rate limiting', () => {
  it('blocks after the limit until the window resets', () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.take('ip', 0)).toBe(true);
    expect(rl.take('ip', 1)).toBe(true);
    expect(rl.take('ip', 2)).toBe(false);
    expect(rl.take('ip', 1001)).toBe(true);
  });
});

describe('config', () => {
  it('turns accounts on only with database settings', () => {
    expect(loadConfig({}).database).toBe(false);
    const c = loadConfig({
      PGHOST: 'db',
      PUBLIC_URL: 'https://fx.example.com/',
      DISCORD_CLIENT_ID: 'id',
      DISCORD_CLIENT_SECRET: 'secret',
    });
    expect(c.database).toBe(true);
    expect(c.publicUrl).toBe('https://fx.example.com');
    expect(c.discord).toEqual({ clientId: 'id', clientSecret: 'secret' });
    expect(() => loadConfig({ PORT: 'x' })).toThrow();
  });
});

describe('local development overrides', () => {
  it('uses DEV_ settings with --dev only', () => {
    const env: NodeJS.ProcessEnv = {
      PGHOST: 'postgres',
      PGPORT: '5432',
      DATABASE_URL: 'postgres://x@postgres/db',
      DEV_PGHOST: 'localhost',
      DEV_PGPORT: '5433',
      PUBLIC_URL: 'https://fx.example.com',
    };
    expect(applyDevOverrides({ ...env }, [])).toEqual([]);
    const dev = { ...env };
    applyDevOverrides(dev, ['node', 'index.js', '--dev']);
    expect(dev.PGHOST).toBe('localhost');
    expect(dev.PGPORT).toBe('5433');
    // The deployment's DATABASE_URL would win over the local PG* settings: dropped.
    expect(dev.DATABASE_URL).toBeUndefined();
    expect(dev.PUBLIC_URL).toBe('http://localhost:5173');
  });
});
