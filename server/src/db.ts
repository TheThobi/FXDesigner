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
