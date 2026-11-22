import type { ServerResponse } from 'node:http';
import type { Config } from './config.js';
import type { Db } from './db.js';
import {
  appendCookie,
  HttpError,
  readJson,
  redirect,
  sendJson,
  serializeCookie,
  type Request,
  type Router,
} from './http.js';
import {
  dummyHash,
  hashPassword,
  pseudoFrom,
  randomToken,
  RateLimiter,
  safeEqual,
  tokenHash,
  validEmail,
  validPassword,
  validPseudo,
  verifyPassword,
} from './security.js';

export interface User {
  readonly id: string;
  readonly pseudo: string;
  readonly email: string | null;
  readonly discord: boolean;
  readonly password: boolean;
}

const SESSION_COOKIE = 'fxd_session';
const STATE_COOKIE = 'fxd_oauth_state';
const SESSION_DAYS = 30;
const BODY_LIMIT = 16 * 1024;

const DISCORD_AUTHORIZE = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN = 'https://discord.com/api/oauth2/token';
const DISCORD_ME = 'https://discord.com/api/users/@me';

interface UserRow {
  id: string;
  pseudo: string;
  email: string | null;
  discord_id: string | null;
  password_hash: string | null;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    pseudo: row.pseudo,
    email: row.email,
    discord: row.discord_id !== null,
    password: row.password_hash !== null,
  };
}

export class Auth {
  private readonly attempts = new RateLimiter(10, 15 * 60_000);
  private readonly secure: boolean;

  constructor(
    private readonly db: Db,
    private readonly config: Config,
  ) {
    this.secure = config.publicUrl.startsWith('https://');
  }

  /** The signed-in user of a request, or null. */
  async user(req: Request): Promise<User | null> {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return null;
    const { rows } = await this.db.query<UserRow>(
      `SELECT u.id, u.pseudo, u.email, u.discord_id, u.password_hash
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash(token)],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async requireUser(req: Request): Promise<User> {
    const user = await this.user(req);
    if (!user) throw new HttpError(401, 'Not signed in');
    return user;
  }

  /** Deletes expired sessions (run periodically). */
  async prune(): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE expires_at <= now()');
  }

  routes(router: Router): void {
    router.add('GET', '/api/auth/me', async (req, res) => {
      sendJson(res, 200, { user: await this.user(req) });
    });

    router.add('POST', '/api/auth/register', async (req, res) => {
      if (!this.config.registration) throw new HttpError(403, 'Registration is closed');
      this.limit(req, 'register');
      const body = (await readJson(req.raw, BODY_LIMIT)) as Record<string, unknown>;
      const { pseudo, email, password } = body;
      if (!validPseudo(pseudo))
        throw new HttpError(400, 'Pseudo: 3 to 24 letters, digits, _ . or -');
      if (!validEmail(email)) throw new HttpError(400, 'Invalid email address');
      if (!validPassword(password)) throw new HttpError(400, 'Password: at least 8 characters');
      const hash = await hashPassword(password);
      try {
        const { rows } = await this.db.query<UserRow>(
          `INSERT INTO users (pseudo, email, password_hash) VALUES ($1, $2, $3)
           RETURNING id, pseudo, email, discord_id, password_hash`,
          [pseudo, email.toLowerCase(), hash],
        );
        await this.startSession(res, rows[0]!.id);
        sendJson(res, 201, { user: toUser(rows[0]!) });
      } catch (e) {
        if ((e as { code?: string }).code === '23505')
          throw new HttpError(409, 'This pseudo or email is already used');
        throw e;
      }
    });

    router.add('POST', '/api/auth/login', async (req, res) => {
      const body = (await readJson(req.raw, BODY_LIMIT)) as Record<string, unknown>;
      const login = typeof body.login === 'string' ? body.login.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      this.limit(req, 'login');
      if (!this.attempts.take(`login:${login.toLowerCase()}`))
        throw new HttpError(429, 'Too many attempts, try again later');
      const { rows } = await this.db.query<UserRow>(
        `SELECT id, pseudo, email, discord_id, password_hash FROM users
          WHERE lower(pseudo) = lower($1) OR lower(email) = lower($1) LIMIT 1`,
        [login],
      );
      const row = rows[0];
      // Same work whether the account exists or not (no user enumeration by timing).
      const ok = await verifyPassword(password, row?.password_hash ?? (await dummyHash()));
      if (!row?.password_hash || !ok) throw new HttpError(401, 'Wrong pseudo / email or password');
      await this.startSession(res, row.id);
      sendJson(res, 200, { user: toUser(row) });
    });

    router.add('POST', '/api/auth/logout', async (req, res) => {
      const token = req.cookies[SESSION_COOKIE];
      if (token)
        await this.db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
      appendCookie(res, serializeCookie(SESSION_COOKIE, '', { secure: this.secure, maxAge: 0 }));
      sendJson(res, 200, { ok: true });
    });

    router.add('GET', '/api/auth/discord', (req, res) => {
      const discord = this.config.discord;
      if (!discord) throw new HttpError(404, 'Discord sign-in is not configured');
      this.limit(req, 'discord');
      const state = randomToken();
      appendCookie(res, serializeCookie(STATE_COOKIE, state, { secure: this.secure, maxAge: 600 }));
      const url = new URL(DISCORD_AUTHORIZE);
      url.search = new URLSearchParams({
        client_id: discord.clientId,
        response_type: 'code',
        redirect_uri: this.discordRedirect(),
        scope: 'identify email',
        state,
        prompt: 'none',
      }).toString();
      redirect(res, url.toString());
    });

    router.add('GET', '/api/auth/discord/callback', async (req, res) => {
      const fail = (reason: string) =>
        redirect(res, `${this.config.publicUrl}/?auth_error=${encodeURIComponent(reason)}`);
      const discord = this.config.discord;
      const state = req.query.get('state') ?? '';
      const expected = req.cookies[STATE_COOKIE] ?? '';
      appendCookie(res, serializeCookie(STATE_COOKIE, '', { secure: this.secure, maxAge: 0 }));
      if (!discord) return fail('Discord sign-in is not configured');
      if (req.query.get('error')) return fail('Discord sign-in was cancelled');
      if (!state || !expected || !safeEqual(state, expected))
        return fail('Sign-in expired, try again');
      const code = req.query.get('code');
      if (!code) return fail('Discord sign-in failed');
      try {
        const profile = await this.discordProfile(code);
        const userId = await this.discordUser(profile);
        await this.startSession(res, userId);
        redirect(res, `${this.config.publicUrl}/`);
      } catch (e) {
        console.error('[auth] discord', e);
        fail('Discord sign-in failed');
      }
    });
  }

  private limit(req: Request, what: string): void {
    if (!this.attempts.take(`${what}:${req.ip}`))
      throw new HttpError(429, 'Too many attempts, try again later');
  }

  private discordRedirect(): string {
    return `${this.config.publicUrl}/api/auth/discord/callback`;
  }

  private async discordProfile(
    code: string,
  ): Promise<{ id: string; username: string; email: string | null }> {
    const discord = this.config.discord!;
    const token = await fetch(DISCORD_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: discord.clientId,
        client_secret: discord.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.discordRedirect(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!token.ok) throw new Error(`token ${token.status}`);
    const { access_token: access } = (await token.json()) as { access_token?: string };
    if (!access) throw new Error('no access token');
    const me = await fetch(DISCORD_ME, {
      headers: { Authorization: `Bearer ${access}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!me.ok) throw new Error(`me ${me.status}`);
    const u = (await me.json()) as {
      id?: string;
      username?: string;
      global_name?: string | null;
      email?: string | null;
      verified?: boolean;
    };
    if (!u.id) throw new Error('no user id');
    return {
      id: u.id,
      username: u.global_name || u.username || 'discord',
      email: u.verified && u.email ? u.email.toLowerCase() : null,
    };
  }

  /**
   * The account of a Discord user, created on first sign-in. Accounts are never merged by
   * email: emails of password accounts are not verified, so linking on them would let anyone
   * take over a Discord user's account.
   */
  private async discordUser(p: { id: string; username: string; email: string | null }) {
    const found = await this.db.query<{ id: string }>(
      'SELECT id FROM users WHERE discord_id = $1',
      [p.id],
    );
    if (found.rows[0]) return found.rows[0].id;
    const base = pseudoFrom(p.username);
    for (let i = 0; i < 20; i++) {
      const pseudo =
        i === 0 ? base : `${base.slice(0, 20)}${Math.floor(Math.random() * 9000 + 1000)}`;
      try {
        const { rows } = await this.db.query<{ id: string }>(
          `INSERT INTO users (pseudo, email, discord_id)
           VALUES ($1, (SELECT $2::text WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = $2)), $3)
           RETURNING id`,
          [pseudo, p.email, p.id],
        );
        return rows[0]!.id;
      } catch (e) {
        if ((e as { code?: string }).code !== '23505') throw e;
      }
    }
    throw new Error('no free pseudo');
  }

  private async startSession(res: ServerResponse, userId: string): Promise<void> {
    const token = randomToken();
    await this.db.query(
      `INSERT INTO sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, now() + make_interval(days => $3))`,
      [tokenHash(token), userId, SESSION_DAYS],
    );
    appendCookie(
      res,
      serializeCookie(SESSION_COOKIE, token, {
        secure: this.secure,
        maxAge: SESSION_DAYS * 86400,
      }),
    );
  }
}
