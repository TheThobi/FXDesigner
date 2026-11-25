import { randomBytes } from 'node:crypto';
import type { Auth } from './auth.js';
import type { Db } from './db.js';
import { HttpError, readJson, sendJson, type Request, type Router } from './http.js';
import { RateLimiter } from './security.js';

/**
 * Community: systems shared by their authors. Anyone can browse and open them; signed-in
 * users publish (name, description, category, tags, thumbnail, document), edit or delete
 * their own, and subscribe to others' (a subscription keeps the system in their list and
 * tells them when it was updated). "Trending" ranks by subscriptions of the last 7 days.
 */

/** Categories (ids are stored; labels are shown by the client). */
export const COMMUNITY_CATEGORIES: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'fire', label: 'Fire & Smoke' },
  { id: 'magic', label: 'Magic & Light' },
  { id: 'impact', label: 'Impacts & Hits' },
  { id: 'water', label: 'Water & Liquids' },
  { id: 'nature', label: 'Nature & Weather' },
  { id: 'particles', label: 'Particles' },
  { id: 'materials', label: 'Materials' },
  { id: 'patterns', label: 'Patterns & Noises' },
  { id: 'ui', label: 'UI & Icons' },
  { id: 'other', label: 'Other' },
];
const CATEGORY_IDS = new Set(COMMUNITY_CATEGORIES.map((c) => c.id));

export const SORTS = ['trending', 'popular', 'new'] as const;
export type CommunitySort = (typeof SORTS)[number];

const PAGE_SIZE = 24;
const MAX_PUBLISHED = 200;
const MAX_DOCUMENT = 4 * 1024 * 1024;
const MAX_THUMB = 512 * 1024;
/** Hover animation of animated systems: a strip of frames side by side. */
const MAX_PREVIEW = 2 * 1024 * 1024;
const BODY_LIMIT = MAX_DOCUMENT + MAX_THUMB + MAX_PREVIEW + 64 * 1024;
const MAX_TAGS = 8;
const ID_RE = /^[a-z0-9]{8,32}$/;
/** Reports from this many different users hide a system until a moderator reviews it. */
export const AUTO_HIDE_REPORTS = 3;
export const REPORT_REASONS = ['inappropriate', 'spam', 'copyright', 'broken', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
const MAX_REPORT_DETAILS = 500;

/** Validates a report body: a known reason and optional details (trimmed, capped). */
export function parseReport(body: unknown): { reason: ReportReason; details: string } {
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const reason = o.reason;
  if (typeof reason !== 'string' || !(REPORT_REASONS as readonly string[]).includes(reason))
    throw new HttpError(400, 'Invalid reason');
  const details = typeof o.details === 'string' ? o.details.trim() : '';
  if (details.length > MAX_REPORT_DETAILS) throw new HttpError(400, 'Details are too long');
  return { reason: reason as ReportReason, details };
}

export interface PublishInput {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly tags: string[];
}

function communityId(raw: string | undefined): string {
  if (!raw || !ID_RE.test(raw)) throw new HttpError(400, 'Invalid id');
  return raw;
}

/** Lowercase words (letters, digits, dashes), unique, at most MAX_TAGS of 24 characters. */
export function normalizeTags(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const tag = item
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\- ]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 24);
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

/** Validated publication metadata; `partial` accepts missing fields (edits). */
export function parsePublishInput(
  body: Record<string, unknown>,
  partial = false,
): Partial<PublishInput> {
  const out: { -readonly [K in keyof PublishInput]?: PublishInput[K] } = {};
  if (body.name !== undefined || !partial) {
    if (typeof body.name !== 'string' || !body.name.trim())
      throw new HttpError(400, 'Invalid name');
    out.name = body.name.trim().slice(0, 64);
  }
  if (body.description !== undefined || !partial) {
    out.description =
      typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : '';
  }
  if (body.category !== undefined || !partial) {
    if (typeof body.category !== 'string' || !CATEGORY_IDS.has(body.category))
      throw new HttpError(400, 'Invalid category');
    out.category = body.category;
  }
  if (body.tags !== undefined || !partial) out.tags = normalizeTags(body.tags);
  return out;
}

function parseImage(raw: unknown, max: number): string | null {
  return typeof raw === 'string' && raw.startsWith('data:image/') && raw.length <= max ? raw : null;
}

const parseThumb = (raw: unknown) => parseImage(raw, MAX_THUMB);
const parsePreview = (raw: unknown) => parseImage(raw, MAX_PREVIEW);

/** Frame count of a hover animation strip (2…64), 0 when invalid. */
function previewFrames(raw: unknown): number {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 2 && raw <= 64 ? raw : 0;
}

function parseDocument(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new HttpError(400, 'Invalid document');
  const doc = JSON.stringify(raw);
  if (/"data:image\//i.test(doc))
    throw new HttpError(
      400,
      'Replace embedded images with direct HTTPS image URLs before publishing',
    );
  if (doc.length > MAX_DOCUMENT) throw new HttpError(413, 'Document too large');
  return doc;
}

/** ILIKE pattern matching `q` literally. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function orderBy(sort: string): string {
  switch (sort) {
    case 'popular':
      return 'subscribers DESC, c.uses DESC, c.updated_at DESC';
    case 'new':
      return 'c.created_at DESC';
    default:
      return 'recent DESC, subscribers DESC, c.updated_at DESC';
  }
}

const SUMMARY = `
  c.id, c.name, c.description, c.category, c.tags, c.thumb, c.version, c.uses, c.animated,
  c.preview_frames, (c.preview IS NOT NULL) AS has_preview, c.hidden,
  (extract(epoch FROM c.created_at) * 1000)::bigint AS created,
  (extract(epoch FROM c.updated_at) * 1000)::bigint AS updated,
  u.pseudo AS author,
  coalesce(c.user_id = $1::uuid, false) AS mine,
  (SELECT count(*) FROM community_subscriptions s WHERE s.system_id = c.id) AS subscribers,
  (SELECT count(*) FROM community_subscriptions s
     WHERE s.system_id = c.id AND s.created_at > now() - interval '7 days') AS recent,
  EXISTS (SELECT 1 FROM community_subscriptions s
     WHERE s.system_id = c.id AND s.user_id = $1::uuid) AS subscribed`;

function summary(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    tags: r.tags,
    thumb: r.thumb,
    animated: r.animated === true,
    previewFrames: r.animated === true && r.has_preview === true ? Number(r.preview_frames) : 0,
    version: Number(r.version),
    hidden: r.hidden === true,
    uses: Number(r.uses),
    created: Number(r.created),
    updated: Number(r.updated),
    author: r.author,
    mine: r.mine === true,
    subscribers: Number(r.subscribers),
    subscribed: r.subscribed === true,
  };
}

export function communityRoutes(
  router: Router,
  db: Db,
  auth: Auth,
  moderators: ReadonlySet<string> = new Set(),
): void {
  const publishes = new RateLimiter(20, 60 * 60_000);
  const uses = new RateLimiter(1, 6 * 60 * 60_000);
  const reports = new RateLimiter(20, 60 * 60_000);
  const viewer = async (req: Request) => (await auth.user(req))?.id ?? null;
  const isModerator = (pseudo: string | undefined) =>
    pseudo !== undefined && moderators.has(pseudo.toLowerCase());
  const requireModerator = async (req: Request) => {
    const user = await auth.requireUser(req);
    if (!isModerator(user.pseudo)) throw new HttpError(403, 'Moderators only');
    return user;
  };

  router.add('GET', '/api/community/moderator', async (req, res) => {
    sendJson(res, 200, { moderator: isModerator((await auth.user(req))?.pseudo) });
  });

  router.add('GET', '/api/community/categories', async (_req, res) => {
    sendJson(res, 200, { categories: COMMUNITY_CATEGORIES, sorts: SORTS });
  });

  router.add('GET', '/api/community/tags', async (req, res) => {
    const query = normalizeTags(req.query.get('q'))[0] ?? '';
    const exclude = normalizeTags(req.query.getAll('exclude'));
    const { rows } = await db.query<{ tag: string; count: string }>(
      `SELECT tag, count(DISTINCT c.id) AS count
       FROM community_systems c CROSS JOIN LATERAL unnest(c.tags) AS tags(tag)
       WHERE NOT c.hidden AND ($1::text = '' OR strpos(tag, $1) > 0)
         AND NOT (tag = ANY($2::text[]))
       GROUP BY tag
       ORDER BY CASE WHEN tag = $1 THEN 0 WHEN strpos(tag, $1) = 1 THEN 1 ELSE 2 END,
                count DESC, tag
       LIMIT 8`,
      [query, exclude],
    );
    sendJson(res, 200, { tags: rows.map(({ tag, count }) => ({ tag, count: Number(count) })) });
  });

  // List: ?scope=all|mine|subscribed &sort=trending|popular|new &category= &q= &page=
  router.add('GET', '/api/community', async (req, res) => {
    const me = await viewer(req);
    const scope = req.query.get('scope') ?? 'all';
    if ((scope === 'mine' || scope === 'subscribed') && !me)
      throw new HttpError(401, 'Not signed in');
    const category = req.query.get('category') ?? '';
    const q = (req.query.get('q') ?? '').trim().slice(0, 64);
    const page = Math.max(0, Math.min(200, Number(req.query.get('page')) || 0));
    // Hidden systems (reported, pending review) only show to their author.
    const where: string[] = ['(NOT c.hidden OR c.user_id = $1::uuid)'];
    const args: unknown[] = [me];
    if (scope === 'mine') where.push('c.user_id = $1::uuid');
    if (scope === 'subscribed')
      where.push(
        'EXISTS (SELECT 1 FROM community_subscriptions s WHERE s.system_id = c.id AND s.user_id = $1::uuid)',
      );
    const kind = req.query.get('kind');
    if (kind === 'animated') where.push('c.animated');
    if (kind === 'static') where.push('NOT c.animated');
    if (category && CATEGORY_IDS.has(category)) {
      args.push(category);
      where.push(`c.category = $${args.length}`);
    }
    if (q) {
      args.push(likePattern(q), q.toLowerCase());
      const like = `$${args.length - 1}`;
      where.push(
        `(c.name ILIKE ${like} OR c.description ILIKE ${like} OR u.pseudo ILIKE ${like} OR $${args.length} = ANY (c.tags))`,
      );
    }
    args.push(PAGE_SIZE + 1, page * PAGE_SIZE);
    const { rows } = await db.query(
      `SELECT ${SUMMARY} FROM community_systems c JOIN users u ON u.id = c.user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY ${orderBy(req.query.get('sort') ?? 'trending')}
       LIMIT $${args.length - 1} OFFSET $${args.length}`,
      args,
    );
    sendJson(res, 200, {
      items: rows.slice(0, PAGE_SIZE).map(summary),
      more: rows.length > PAGE_SIZE,
    });
  });

  // Hover animation strip (loaded on demand: too heavy for the list).
  router.add('GET', '/api/community/:id/preview', async (req, res) => {
    const { rows } = await db.query(
      'SELECT preview, preview_frames FROM community_systems WHERE id = $1 AND animated',
      [communityId(req.params.id)],
    );
    if (!rows[0]?.preview) throw new HttpError(404, 'No preview');
    sendJson(res, 200, { url: rows[0].preview, frames: Number(rows[0].preview_frames) });
  });

  router.add('GET', '/api/community/:id', async (req, res) => {
    const user = await auth.user(req);
    const me = user?.id ?? null;
    const { rows } = await db.query(
      `SELECT ${SUMMARY}, c.document FROM community_systems c JOIN users u ON u.id = c.user_id
       WHERE c.id = $2`,
      [me, communityId(req.params.id)],
    );
    if (!rows[0] || (rows[0].hidden && !rows[0].mine && !isModerator(user?.pseudo)))
      throw new HttpError(404, 'No such system');
    sendJson(res, 200, { ...summary(rows[0]), document: rows[0].document });
  });

  router.add('POST', '/api/community', async (req, res) => {
    const user = await auth.requireUser(req);
    if (!publishes.take(user.id)) throw new HttpError(429, 'Too many publications, try later');
    const body = (await readJson(req.raw, BODY_LIMIT)) as Record<string, unknown>;
    const meta = parsePublishInput(body) as PublishInput;
    const doc = parseDocument(body.document);
    const count = await db.query<{ n: string }>(
      'SELECT count(*) AS n FROM community_systems WHERE user_id = $1',
      [user.id],
    );
    if (Number(count.rows[0]!.n) >= MAX_PUBLISHED)
      throw new HttpError(403, `At most ${MAX_PUBLISHED} published systems per account`);
    const cid = randomBytes(9).toString('hex');
    const frames = previewFrames(body.previewFrames);
    const preview = frames ? parsePreview(body.preview) : null;
    await db.query(
      `INSERT INTO community_systems
         (id, user_id, name, description, category, tags, thumb, document, animated, preview,
          preview_frames)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
      [
        cid,
        user.id,
        meta.name,
        meta.description,
        meta.category,
        meta.tags,
        parseThumb(body.thumb),
        doc,
        body.animated === true,
        preview,
        preview ? frames : 0,
      ],
    );
    sendJson(res, 200, { id: cid, version: 1 });
  });

  // Edit (owner): metadata, and a new version when a document comes with it.
  router.add('PUT', '/api/community/:id', async (req, res) => {
    const user = await auth.requireUser(req);
    const cid = communityId(req.params.id);
    const body = (await readJson(req.raw, BODY_LIMIT)) as Record<string, unknown>;
    const meta = parsePublishInput(body, true);
    const sets: string[] = [];
    const args: unknown[] = [cid, user.id];
    const set = (column: string, value: unknown, cast = '') => {
      args.push(value);
      sets.push(`${column} = $${args.length}${cast}`);
    };
    if (meta.name !== undefined) set('name', meta.name);
    if (meta.description !== undefined) set('description', meta.description);
    if (meta.category !== undefined) set('category', meta.category);
    if (meta.tags !== undefined) set('tags', meta.tags);
    if (body.document !== undefined) {
      set('document', parseDocument(body.document), '::jsonb');
      sets.push('version = version + 1');
    }
    if (body.animated !== undefined) set('animated', body.animated === true);
    if (body.thumb !== undefined) set('thumb', parseThumb(body.thumb));
    if (body.preview !== undefined) {
      const frames = previewFrames(body.previewFrames);
      const preview = frames ? parsePreview(body.preview) : null;
      set('preview', preview);
      set('preview_frames', preview ? frames : 0);
    }
    if (!sets.length) throw new HttpError(400, 'Nothing to change');
    const { rows } = await db.query<{ version: number }>(
      `UPDATE community_systems SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $1 AND user_id = $2 RETURNING version`,
      args,
    );
    if (!rows[0]) throw new HttpError(404, 'No such system of yours');
    sendJson(res, 200, { ok: true, version: Number(rows[0].version) });
  });

  // Delete: the author, or a moderator.
  router.add('DELETE', '/api/community/:id', async (req, res) => {
    const user = await auth.requireUser(req);
    const { rowCount } = await db.query(
      'DELETE FROM community_systems WHERE id = $1 AND (user_id = $2 OR $3)',
      [communityId(req.params.id), user.id, isModerator(user.pseudo)],
    );
    if (rowCount !== 1) throw new HttpError(404, 'No such system of yours');
    sendJson(res, 200, { ok: true });
  });

  router.add('PUT', '/api/community/:id/subscription', async (req, res) => {
    const user = await auth.requireUser(req);
    const cid = communityId(req.params.id);
    const { rowCount } = await db.query(
      `INSERT INTO community_subscriptions (user_id, system_id)
       SELECT $1, id FROM community_systems WHERE id = $2
       ON CONFLICT DO NOTHING`,
      [user.id, cid],
    );
    if (rowCount === 0) {
      const exists = await db.query('SELECT 1 FROM community_systems WHERE id = $1', [cid]);
      if (!exists.rows[0]) throw new HttpError(404, 'No such system');
    }
    sendJson(res, 200, { ok: true });
  });

  router.add('DELETE', '/api/community/:id/subscription', async (req, res) => {
    const user = await auth.requireUser(req);
    await db.query('DELETE FROM community_subscriptions WHERE user_id = $1 AND system_id = $2', [
      user.id,
      communityId(req.params.id),
    ]);
    sendJson(res, 200, { ok: true });
  });

  // Counts a copy into someone's library (once per visitor and system every 6 hours).
  router.add('POST', '/api/community/:id/use', async (req, res) => {
    const cid = communityId(req.params.id);
    if (uses.take(`${req.ip}:${cid}`))
      await db.query('UPDATE community_systems SET uses = uses + 1 WHERE id = $1', [cid]);
    sendJson(res, 200, { ok: true });
  });

  // Report a system (signed in, not your own). Enough distinct reports hide it for review.
  router.add('POST', '/api/community/:id/report', async (req, res) => {
    const user = await auth.requireUser(req);
    if (!reports.take(user.id)) throw new HttpError(429, 'Too many reports, try later');
    const cid = communityId(req.params.id);
    const { reason, details } = parseReport(await readJson(req.raw, 4 * 1024));
    const owner = await db.query<{ user_id: string }>(
      'SELECT user_id FROM community_systems WHERE id = $1',
      [cid],
    );
    if (!owner.rows[0]) throw new HttpError(404, 'No such system');
    if (owner.rows[0].user_id === user.id) throw new HttpError(400, 'This system is yours');
    await db.query(
      `INSERT INTO community_reports (system_id, user_id, reason, details) VALUES ($1, $2, $3, $4)
       ON CONFLICT (system_id, user_id)
       DO UPDATE SET reason = $3, details = $4, created_at = now()`,
      [cid, user.id, reason, details],
    );
    await db.query(
      `UPDATE community_systems SET hidden = true
       WHERE id = $1 AND (SELECT count(*) FROM community_reports WHERE system_id = $1) >= $2`,
      [cid, AUTO_HIDE_REPORTS],
    );
    sendJson(res, 200, { ok: true });
  });

  // Moderation queue: reported or hidden systems, most reported first.
  router.add('GET', '/api/community/reports', async (req, res) => {
    const user = await requireModerator(req);
    const { rows } = await db.query(
      `SELECT ${SUMMARY},
         (SELECT count(*) FROM community_reports r WHERE r.system_id = c.id) AS report_count,
         coalesce((SELECT json_agg(json_build_object(
             'reason', r.reason, 'details', r.details, 'by', ru.pseudo,
             'at', (extract(epoch FROM r.created_at) * 1000)::bigint)
             ORDER BY r.created_at DESC)
           FROM community_reports r JOIN users ru ON ru.id = r.user_id
           WHERE r.system_id = c.id), '[]'::json) AS reports
       FROM community_systems c JOIN users u ON u.id = c.user_id
       WHERE c.hidden OR EXISTS (SELECT 1 FROM community_reports r WHERE r.system_id = c.id)
       ORDER BY report_count DESC, c.updated_at DESC
       LIMIT 100`,
      [user.id],
    );
    sendJson(res, 200, {
      items: rows.map((r) => ({
        ...summary(r),
        reportCount: Number(r.report_count),
        reports: r.reports,
      })),
    });
  });

  // Moderator decision: hide / show a system, and optionally dismiss its reports.
  router.add('PUT', '/api/community/:id/moderation', async (req, res) => {
    await requireModerator(req);
    const cid = communityId(req.params.id);
    const body = (await readJson(req.raw, 1024)) as Record<string, unknown>;
    if (typeof body.hidden !== 'boolean') throw new HttpError(400, 'hidden must be a boolean');
    const { rowCount } = await db.query('UPDATE community_systems SET hidden = $2 WHERE id = $1', [
      cid,
      body.hidden,
    ]);
    if (rowCount !== 1) throw new HttpError(404, 'No such system');
    if (body.dismiss === true)
      await db.query('DELETE FROM community_reports WHERE system_id = $1', [cid]);
    sendJson(res, 200, { ok: true });
  });
}
