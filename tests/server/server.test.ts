import { describe, expect, it } from 'vitest';
import {
  kindFilter,
  likePattern,
  normalizeTags,
  orderBy,
  parseKind,
  parseNodeDocument,
  parsePublishInput,
  parseReport,
} from '../../server/src/community';
import { parsePublished } from '../../server/src/library';
import { parseUserData, userDataKey } from '../../server/src/userData';
import { applyDevOverrides, loadConfig, parseModerators } from '../../server/src/config';
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

  it('prefers literal paths over parameters, whatever the order', () => {
    const r = new Router();
    const byId = () => undefined;
    const reports = () => undefined;
    r.add('GET', '/api/community/:id', byId);
    r.add('GET', '/api/community/reports', reports);
    expect(r.match('GET', '/api/community/reports')?.handler).toBe(reports);
    expect(r.match('GET', '/api/community/abcdef123')?.handler).toBe(byId);
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

describe('community', () => {
  it('normalizes tags', () => {
    expect(normalizeTags('Fire, Loop!, loop,  big smoke ')).toEqual(['fire', 'loop', 'big-smoke']);
    expect(normalizeTags(['a', 3, 'a', 'b'])).toEqual(['a', 'b']);
    expect(normalizeTags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(8);
    expect(normalizeTags(null)).toEqual([]);
  });

  it('validates publications', () => {
    expect(
      parsePublishInput({ name: ' Ring ', category: 'fire', tags: 'a', description: 3 }),
    ).toEqual({ name: 'Ring', category: 'fire', tags: ['a'], description: '' });
    expect(() => parsePublishInput({ name: '', category: 'fire' })).toThrow();
    expect(() => parsePublishInput({ name: 'x', category: 'nope' })).toThrow();
    // Edits only carry the changed fields.
    expect(parsePublishInput({ description: 'new' }, true)).toEqual({ description: 'new' });
  });

  it('keeps a valid publication link of a library system only', () => {
    expect(JSON.parse(parsePublished({ id: 'abcdef012345', version: 2, hash: 'x' })!)).toEqual({
      id: 'abcdef012345',
      version: 2,
      hash: 'x',
    });
    expect(parsePublished({ id: '../x', version: 2, hash: 'x' })).toBeNull();
    expect(parsePublished({ id: 'abcdef012345', version: '2', hash: 'x' })).toBeNull();
    expect(parsePublished(null)).toBeNull();
    expect(JSON.parse(parsePublished({ id: 'abcdef012345', hash: 'x' })!)).toEqual({
      id: 'abcdef012345',
      version: null,
      hash: 'x',
    });
    expect(parsePublished({ id: 'abcdef012345', version: -1, hash: 'x' })).toBeNull();
    expect(parsePublished({ id: 'abcdef012345', version: 1, hash: 'x'.repeat(5000) })).toBeNull();
  });

  it('escapes search patterns and whitelists sorts', () => {
    expect(likePattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
    expect(orderBy('new')).toContain('created_at');
    expect(orderBy('popular')).toContain('subscribers');
    expect(orderBy('; DROP TABLE users')).toContain('recent');
  });
});

describe('community shader nodes', () => {
  const node = (extra: Record<string, unknown>) => ({
    format: 'fx-designer',
    nodes: [{ id: 'n1', generator: 'fractal-noise', ...extra }],
    links: [],
  });

  it('reads the publication kind and list filter', () => {
    expect(parseKind(undefined)).toBe('system');
    expect(parseKind('node')).toBe('node');
    expect(() => parseKind('script')).toThrow('Invalid kind');
    // Older clients list systems only; 'all' lists both.
    expect(kindFilter(null)).toBe('system');
    expect(kindFilter('node')).toBe('node');
    expect(kindFilter('all')).toBe('');
    expect(kindFilter('nope')).toBe('system');
  });

  it('accepts one custom shader node only', () => {
    expect(JSON.parse(parseNodeDocument(node({ code: 'vec4 generate(vec2 uv);' })))).toEqual(
      node({ code: 'vec4 generate(vec2 uv);' }),
    );
    expect(() => parseNodeDocument(node({ customParams: [{ key: 'a' }] }))).not.toThrow();
    expect(() => parseNodeDocument(node({}))).toThrow('Not a custom shader node');
    expect(() => parseNodeDocument(node({ code: 'x'.repeat(70_000) }))).toThrow('Code too long');
    expect(() =>
      parseNodeDocument({ ...node({ code: 'x' }), links: [{ from: 'n1', to: 'n1' }] }),
    ).toThrow('no links');
    const two = node({ code: 'x' });
    expect(() => parseNodeDocument({ ...two, nodes: [...two.nodes, ...two.nodes] })).toThrow(
      'one node',
    );
    expect(() => parseNodeDocument(node({ generator: 3, code: 'x' }))).toThrow('Invalid node');
  });
});

describe('user data', () => {
  it('accepts known keys and bounded objects', () => {
    expect(userDataKey('community')).toBe('community');
    expect(() => userDataKey('../x')).toThrow('Unknown key');
    expect(parseUserData({ a: 1 })).toBe('{"a":1}');
    expect(() => parseUserData([1])).toThrow('Invalid value');
    expect(() => parseUserData({ big: 'x'.repeat(600_000) })).toThrow('too large');
  });
});

describe('moderation', () => {
  it('validates reports', () => {
    expect(parseReport({ reason: 'spam', details: '  ads  ' })).toEqual({
      reason: 'spam',
      details: 'ads',
    });
    expect(parseReport({ reason: 'broken' })).toEqual({ reason: 'broken', details: '' });
    expect(() => parseReport({ reason: 'nope' })).toThrow('Invalid reason');
    expect(() => parseReport(null)).toThrow('Invalid reason');
    expect(() => parseReport({ reason: 'other', details: 'x'.repeat(501) })).toThrow('too long');
  });

  it('reads moderators from the environment (case-insensitive pseudos)', () => {
    expect([...parseModerators(' Alice, bob ,,')]).toEqual(['alice', 'bob']);
    expect(parseModerators(undefined).size).toBe(0);
    expect(loadConfig({ MODERATORS: 'Zed' }).moderators.has('zed')).toBe(true);
  });
});
