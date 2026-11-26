import type { Auth } from './auth.js';
import type { Db } from './db.js';
import { HttpError, readJson, sendJson, type Router } from './http.js';

/**
 * Small per-account settings mirrored by the client, one JSON value per key, last write wins
 * (the client merges entry by entry before writing, see app/communitySync.ts). `community`:
 * installed community nodes (ids and versions) and the links "this graph node is my
 * published node".
 */
export const USER_DATA_KEYS: ReadonlySet<string> = new Set(['community']);
const MAX_VALUE = 512 * 1024;

export function userDataKey(raw: string | undefined): string {
  if (!raw || !USER_DATA_KEYS.has(raw)) throw new HttpError(400, 'Unknown key');
  return raw;
}

/** The stored JSON of a value: an object, at most MAX_VALUE characters. */
export function parseUserData(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new HttpError(400, 'Invalid value');
  const json = JSON.stringify(raw);
  if (json.length > MAX_VALUE) throw new HttpError(413, 'Value too large');
  return json;
}

export function userDataRoutes(router: Router, db: Db, auth: Auth): void {
  router.add('GET', '/api/user-data/:key', async (req, res) => {
    const user = await auth.requireUser(req);
    const { rows } = await db.query<{ value: unknown; updated: string }>(
      'SELECT value, updated FROM user_data WHERE user_id = $1 AND key = $2',
      [user.id, userDataKey(req.params.key)],
    );
    sendJson(res, 200, {
      value: rows[0]?.value ?? null,
      updated: rows[0] ? Number(rows[0].updated) : 0,
    });
  });

  router.add('PUT', '/api/user-data/:key', async (req, res) => {
    const user = await auth.requireUser(req);
    const key = userDataKey(req.params.key);
    const body = (await readJson(req.raw, MAX_VALUE + 1024)) as Record<string, unknown>;
    const value = parseUserData(body.value);
    const updated = Date.now();
    await db.query(
      `INSERT INTO user_data (user_id, key, value, updated) VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (user_id, key) DO UPDATE SET value = $3::jsonb, updated = $4`,
      [user.id, key, value, updated],
    );
    sendJson(res, 200, { ok: true, updated });
  });
}
