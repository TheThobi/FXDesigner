import type { Auth } from './auth.js';
import type { Db } from './db.js';
import { HttpError, readJson, sendJson, type Router } from './http.js';

/** Per-account limits. */
const MAX_SYSTEMS = 500;
const MAX_FOLDERS = 100;
const MAX_DOCUMENT = 4 * 1024 * 1024;
const MAX_THUMB = 256 * 1024;
const BODY_LIMIT = MAX_DOCUMENT + MAX_THUMB + 64 * 1024;
const ID_RE = /^[a-z0-9]{1,40}$/i;

function id(raw: string | undefined): string {
  if (!raw || !ID_RE.test(raw)) throw new HttpError(400, 'Invalid id');
  return raw;
}

function name(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) throw new HttpError(400, 'Invalid name');
  return raw.trim().slice(0, 64);
}

function stamp(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0)
    throw new HttpError(400, 'Invalid date');
  return Math.round(raw);
}

/**
 * The library of an account, mirrored by the client (app/cloud.ts): folders and systems
 * (document + thumbnail), last write wins by `updated`. Deletions leave tombstones so other
 * devices remove their copy too.
 */
export function libraryRoutes(router: Router, db: Db, auth: Auth): void {
  router.add('GET', '/api/library', async (req, res) => {
    const user = await auth.requireUser(req);
    const [folders, systems, tombstones] = await Promise.all([
      db.query('SELECT id, name, updated FROM folders WHERE user_id = $1', [user.id]),
      db.query('SELECT id, name, folder, updated, thumb FROM systems WHERE user_id = $1', [
        user.id,
      ]),
      db.query('SELECT kind, id, deleted FROM tombstones WHERE user_id = $1', [user.id]),
    ]);
    const num = (r: Record<string, unknown>, k: string) => Number(r[k]);
    sendJson(res, 200, {
      folders: folders.rows.map((r) => ({ ...r, updated: num(r, 'updated') })),
      systems: systems.rows.map((r) => ({ ...r, updated: num(r, 'updated') })),
      tombstones: tombstones.rows.map((r) => ({ ...r, deleted: num(r, 'deleted') })),
    });
  });

  router.add('GET', '/api/library/systems/:id', async (req, res) => {
    const user = await auth.requireUser(req);
    const { rows } = await db.query(
      'SELECT id, name, folder, updated, thumb, document FROM systems WHERE user_id = $1 AND id = $2',
      [user.id, id(req.params.id)],
    );
    if (!rows[0]) throw new HttpError(404, 'No such system');
    sendJson(res, 200, { ...rows[0], updated: Number(rows[0].updated) });
  });

  router.add('PUT', '/api/library/systems/:id', async (req, res) => {
    const user = await auth.requireUser(req);
    const sid = id(req.params.id);
    const body = (await readJson(req.raw, BODY_LIMIT)) as Record<string, unknown>;
    const folder =
      body.folder === null || body.folder === undefined ? null : id(String(body.folder));
    const thumb =
      typeof body.thumb === 'string' &&
      body.thumb.startsWith('data:image/') &&
      body.thumb.length <= MAX_THUMB
        ? body.thumb
        : null;
    if (typeof body.document !== 'object' || body.document === null)
      throw new HttpError(400, 'Invalid document');
    const doc = JSON.stringify(body.document);
    if (doc.length > MAX_DOCUMENT) throw new HttpError(413, 'Document too large');
    const updated = stamp(body.updated);
    const count = await db.query<{ n: string }>(
      'SELECT count(*) AS n FROM systems WHERE user_id = $1 AND id <> $2',
      [user.id, sid],
    );
    if (Number(count.rows[0]!.n) >= MAX_SYSTEMS)
      throw new HttpError(403, `At most ${MAX_SYSTEMS} systems per account`);
    // Last write wins: an older copy never overwrites a newer one.
    const { rowCount } = await db.query(
      `INSERT INTO systems (user_id, id, name, folder, updated, thumb, document)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (user_id, id) DO UPDATE
         SET name = EXCLUDED.name, folder = EXCLUDED.folder, updated = EXCLUDED.updated,
             thumb = EXCLUDED.thumb, document = EXCLUDED.document
       WHERE systems.updated <= EXCLUDED.updated`,
      [user.id, sid, name(body.name), folder, updated, thumb, doc],
    );
    await db.query("DELETE FROM tombstones WHERE user_id = $1 AND kind = 'system' AND id = $2", [
      user.id,
      sid,
    ]);
    sendJson(res, 200, { stored: rowCount === 1 });
  });

  router.add('DELETE', '/api/library/systems/:id', async (req, res) => {
    const user = await auth.requireUser(req);
    const sid = id(req.params.id);
    await db.query('DELETE FROM systems WHERE user_id = $1 AND id = $2', [user.id, sid]);
    await tombstone(db, user.id, 'system', sid);
    sendJson(res, 200, { ok: true });
  });

  router.add('PUT', '/api/library/folders/:id', async (req, res) => {
    const user = await auth.requireUser(req);
    const fid = id(req.params.id);
    const body = (await readJson(req.raw, 16 * 1024)) as Record<string, unknown>;
    const count = await db.query<{ n: string }>(
      'SELECT count(*) AS n FROM folders WHERE user_id = $1 AND id <> $2',
      [user.id, fid],
    );
    if (Number(count.rows[0]!.n) >= MAX_FOLDERS)
      throw new HttpError(403, `At most ${MAX_FOLDERS} folders per account`);
    await db.query(
      `INSERT INTO folders (user_id, id, name, updated) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, id) DO UPDATE SET name = EXCLUDED.name, updated = EXCLUDED.updated
       WHERE folders.updated <= EXCLUDED.updated`,
      [user.id, fid, name(body.name), stamp(body.updated)],
    );
    await db.query("DELETE FROM tombstones WHERE user_id = $1 AND kind = 'folder' AND id = $2", [
      user.id,
      fid,
    ]);
    sendJson(res, 200, { ok: true });
  });

  router.add('DELETE', '/api/library/folders/:id', async (req, res) => {
    const user = await auth.requireUser(req);
    const fid = id(req.params.id);
    await db.query('UPDATE systems SET folder = NULL WHERE user_id = $1 AND folder = $2', [
      user.id,
      fid,
    ]);
    await db.query('DELETE FROM folders WHERE user_id = $1 AND id = $2', [user.id, fid]);
    await tombstone(db, user.id, 'folder', fid);
    sendJson(res, 200, { ok: true });
  });
}

async function tombstone(db: Db, user: string, kind: string, tid: string): Promise<void> {
  await db.query(
    `INSERT INTO tombstones (user_id, kind, id, deleted) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, kind, id) DO UPDATE SET deleted = EXCLUDED.deleted`,
    [user, kind, tid, Date.now()],
  );
}
