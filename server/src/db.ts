import pg from 'pg';

/**
 * Schema migrations, applied in order at startup (each once, in a transaction, under an
 * advisory lock so two instances never race). Append new steps; never edit applied ones.
 */
export const MIGRATIONS: readonly string[] = [
  // 1: accounts, sessions, library (folders, systems, deletions for multi-device sync).
  `
  CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pseudo text NOT NULL,
    email text,
    password_hash text,
    discord_id text UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX users_pseudo_key ON users (lower(pseudo));
  CREATE UNIQUE INDEX users_email_key ON users (lower(email)) WHERE email IS NOT NULL;

  CREATE TABLE sessions (
    token_hash bytea PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX sessions_user ON sessions (user_id);

  CREATE TABLE folders (
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    id text NOT NULL,
    name text NOT NULL,
    updated bigint NOT NULL,
    PRIMARY KEY (user_id, id)
  );

  CREATE TABLE systems (
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    id text NOT NULL,
    name text NOT NULL,
    folder text,
    updated bigint NOT NULL,
    thumb text,
    document jsonb NOT NULL,
    PRIMARY KEY (user_id, id)
  );

  CREATE TABLE tombstones (
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    kind text NOT NULL,
    id text NOT NULL,
    deleted bigint NOT NULL,
    PRIMARY KEY (user_id, kind, id)
  );
  `,
  // 2: community (published systems, subscriptions).
  `
  CREATE TABLE community_systems (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    category text NOT NULL,
    tags text[] NOT NULL DEFAULT '{}',
    thumb text,
    document jsonb NOT NULL,
    version int NOT NULL DEFAULT 1,
    uses int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX community_systems_user ON community_systems (user_id);
  CREATE INDEX community_systems_category ON community_systems (category, created_at DESC);

  CREATE TABLE community_subscriptions (
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    system_id text NOT NULL REFERENCES community_systems ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, system_id)
  );
  CREATE INDEX community_subscriptions_system ON community_subscriptions (system_id, created_at);
  `,
  // 3: animated / static community systems with a hover animation strip; library systems
  // remember their community publication (id, version, content hash, preview framing).
  `
  ALTER TABLE community_systems
    ADD COLUMN animated boolean NOT NULL DEFAULT false,
    ADD COLUMN preview text,
    ADD COLUMN preview_frames int NOT NULL DEFAULT 0;
  CREATE INDEX community_systems_animated ON community_systems (animated, created_at DESC);
  ALTER TABLE systems ADD COLUMN published jsonb;
  `,
  // 4: moderation: reports by signed-in users, systems hidden pending review.
  `
  ALTER TABLE community_systems ADD COLUMN hidden boolean NOT NULL DEFAULT false;
  CREATE TABLE community_reports (
    system_id text NOT NULL REFERENCES community_systems ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    reason text NOT NULL,
    details text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (system_id, user_id)
  );
  CREATE INDEX community_reports_system ON community_reports (system_id);
  `,
  // 5: community publications are systems (whole documents) or custom shader nodes.
  `
  ALTER TABLE community_systems ADD COLUMN kind text NOT NULL DEFAULT 'system';
  CREATE INDEX community_systems_kind ON community_systems (kind, created_at DESC);
  `,
  // 6: small per-account settings (installed community nodes, node publication links).
  `
  CREATE TABLE user_data (
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    key text NOT NULL,
    value jsonb NOT NULL,
    updated bigint NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  `,
];

export type Db = pg.Pool;

/** Connection pool (settings from DATABASE_URL or the PG* variables). */
export function createPool(): Db {
  const url = process.env.DATABASE_URL;
  return new pg.Pool({
    ...(url ? { connectionString: url } : {}),
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

export async function migrate(db: Db): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('SELECT pg_advisory_lock(7712001)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const done = new Set(
      (await client.query<{ version: number }>('SELECT version FROM schema_migrations')).rows.map(
        (r) => r.version,
      ),
    );
    for (const [i, sql] of MIGRATIONS.entries()) {
      const version = i + 1;
      if (done.has(version)) continue;
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
        console.log(`[db] migration ${version} applied`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(7712001)').catch(() => undefined);
    client.release();
  }
}
