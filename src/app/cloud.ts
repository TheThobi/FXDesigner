/**
 * Accounts and library sync with the FX Designer server (server/). The static app works
 * without it: `available` stays false when /api/health doesn't answer (e.g. the nginx-only
 * image). Signed in, every local library change is pushed (debounced), and a full
 * reconciliation runs at sign-in and when the tab regains focus: last write wins by
 * `updated`, deletions travel as tombstones.
 */
import type { Library, LibraryChange, PublishedLink, SystemEntry } from './library';

export interface AccountUser {
  readonly id: string;
  readonly pseudo: string;
  readonly email: string | null;
  readonly discord: boolean;
  readonly password: boolean;
}

interface Health {
  readonly accounts: boolean;
  readonly discord: boolean;
  readonly registration: boolean;
}

interface RemoteSystem {
  readonly id: string;
  readonly name: string;
  readonly folder: string | null;
  readonly updated: number;
  readonly thumb: string | null;
  readonly published?: PublishedLink | null;
}

interface RemoteLibrary {
  readonly folders: readonly { id: string; name: string; updated: number }[];
  readonly systems: readonly RemoteSystem[];
  readonly tombstones: readonly { kind: string; id: string; deleted: number }[];
}

export class CloudError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const PUSH_DELAY_MS = 1500;
/** Relative to the page: works when the app is served under a sub-path. */
const API = 'api/';

export async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new CloudError(res.status, body.error ?? `Server error (${res.status})`);
  return body as T;
}

export class Cloud {
  health: Health | null = null;
  user: AccountUser | null = null;
  syncing = false;
  /** Last sync problem (shown in the account menu), null when everything is pushed. */
  problem: string | null = null;
  /** Account or sync state changed (toolbar refresh). */
  onState: (() => void) | null = null;
  /** Systems replaced or removed by the server (App reloads the open one if needed). */
  onRemoteChange: ((ids: readonly string[]) => void) | null = null;

  private readonly pending = new Map<string, LibraryChange>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly library: Library) {
    library.onChange = (change) => this.queue(change);
    window.addEventListener('focus', () => {
      if (this.user) void this.sync();
    });
  }

  get available(): boolean {
    return this.health?.accounts === true;
  }

  /** Checks the server, restores the session and syncs. */
  async init(): Promise<void> {
    try {
      this.health = await call<Health>('health');
    } catch {
      this.health = null;
    }
    if (this.available) {
      try {
        this.user = (await call<{ user: AccountUser | null }>('auth/me')).user;
      } catch {
        this.user = null;
      }
    }
    this.emit();
    if (this.user) await this.sync();
  }

  async register(pseudo: string, email: string, password: string): Promise<void> {
    const r = await call<{ user: AccountUser }>('auth/register', {
      method: 'POST',
      body: JSON.stringify({ pseudo, email, password }),
    });
    this.user = r.user;
    this.emit();
    await this.sync();
  }

  async login(login: string, password: string): Promise<void> {
    const r = await call<{ user: AccountUser }>('auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    this.user = r.user;
    this.emit();
    await this.sync();
  }

  /** Full-page redirect to Discord (back on the app, signed in). */
  discordSignIn(): void {
    window.location.assign(`${API}auth/discord`);
  }

  async logout(): Promise<void> {
    await this.flush().catch(() => undefined);
    await call('auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined);
    this.user = null;
    this.pending.clear();
    this.emit();
  }

  statusText(): string | null {
    if (!this.user) return null;
    if (this.syncing) return `Syncing with ${this.user.pseudo}…`;
    if (this.problem) return `Not synced: ${this.problem}`;
    if (this.pending.size) return 'Changes waiting to sync';
    return 'Synced with account';
  }

  /** Pushes waiting changes now. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (!this.user || this.pending.size === 0) return;
    const changes = [...this.pending.values()];
    this.pending.clear();
    try {
      for (const c of changes) await this.push(c);
      this.problem = null;
    } catch (e) {
      // Keep them for the next attempt (newer edits of the same item win).
      for (const c of changes) if (!this.pending.has(key(c))) this.pending.set(key(c), c);
      this.problem = e instanceof Error ? e.message : String(e);
    }
    this.emit();
  }

  /**
   * Reconciles the local library with the account: newer side wins per system / folder,
   * tombstones remove local copies older than the deletion.
   */
  async sync(): Promise<void> {
    if (!this.user || this.syncing) return;
    this.syncing = true;
    this.emit();
    const changed: string[] = [];
    try {
      await this.flush();
      const remote = await call<RemoteLibrary>('library');
      const lib = this.library;
      for (const t of remote.tombstones) {
        if (t.kind === 'folder') {
          const f = lib.folder(t.id);
          if (f && f.updated <= t.deleted) lib.applyRemoteRemoval('folder', t.id);
        } else {
          const s = lib.get(t.id);
          if (s && s.updated <= t.deleted) {
            lib.applyRemoteRemoval('system', t.id);
            changed.push(t.id);
          }
        }
      }
      const remoteFolders = new Map(remote.folders.map((f) => [f.id, f]));
      for (const f of remote.folders) {
        const local = lib.folder(f.id);
        if (!local || f.updated > local.updated) lib.applyRemoteFolder(f);
      }
      for (const f of lib.folders()) {
        const r = remoteFolders.get(f.id);
        if (!r || f.updated > r.updated) await this.push({ kind: 'folder', id: f.id });
      }
      const remoteSystems = new Map(remote.systems.map((s) => [s.id, s]));
      for (const s of remote.systems) {
        const local = lib.get(s.id);
        if (local && local.updated >= s.updated) continue;
        const full = await call<RemoteSystem & { document: unknown }>(
          `library/systems/${encodeURIComponent(s.id)}`,
        );
        // The user may have edited or published while this request was in flight.
        const latest = lib.get(s.id);
        if (local && !latest) continue;
        if (latest && latest.updated >= full.updated) continue;
        const entry: SystemEntry = {
          id: full.id,
          name: full.name,
          folder: full.folder,
          updated: full.updated,
          thumb: full.thumb,
          published: full.published,
        };
        lib.applyRemoteSystem(entry, full.document);
        changed.push(s.id);
      }
      for (const s of lib.list()) {
        const r = remoteSystems.get(s.id);
        if (!r || s.updated > r.updated) await this.push({ kind: 'system', id: s.id });
      }
      this.problem = null;
    } catch (e) {
      this.problem = e instanceof Error ? e.message : String(e);
      if (e instanceof CloudError && e.status === 401) this.user = null;
    } finally {
      this.syncing = false;
      this.emit();
    }
    if (changed.length) this.onRemoteChange?.(changed);
  }

  private queue(change: LibraryChange): void {
    if (!this.user) return;
    this.pending.set(key(change), change);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), PUSH_DELAY_MS);
  }

  private async push(c: LibraryChange): Promise<void> {
    const lib = this.library;
    const path = (kind: string) => `library/${kind}/${encodeURIComponent(c.id)}`;
    switch (c.kind) {
      case 'system': {
        const s = lib.get(c.id);
        if (!s) return;
        await call(path('systems'), {
          method: 'PUT',
          body: JSON.stringify({ ...s, document: lib.load(c.id) ?? {} }),
        });
        return;
      }
      case 'system-removed':
        await call(path('systems'), { method: 'DELETE' });
        return;
      case 'folder': {
        const f = lib.folder(c.id);
        if (f) await call(path('folders'), { method: 'PUT', body: JSON.stringify(f) });
        return;
      }
      case 'folder-removed':
        await call(path('folders'), { method: 'DELETE' });
    }
  }

  private emit(): void {
    this.onState?.();
  }
}

/** One pending change per item (a removal replaces an edit and vice versa). */
function key(c: LibraryChange): string {
  return `${c.kind.startsWith('folder') ? 'f' : 's'}:${c.id}`;
}
