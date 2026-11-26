/**
 * Syncs the community state of the account across devices (server: user-data `community`):
 * the installed community nodes (ids and versions: their packages are downloaded again from
 * the community) and the links "this graph node is my published node" (NodeLinks), so a
 * node published on one device is updated, not published twice, from another.
 *
 * Merge: last write wins per entry, removals as tombstones (syncedEntries.ts). It runs after
 * every library sync (sign-in, window focus) and shortly after a local change.
 */
import { call, type Cloud } from './cloud';
import type { CommunitySystem } from './community';
import {
  parseNodeLink,
  type InstalledNode,
  type InstalledNodes,
  type InstalledRef,
  type NodeLink,
  type NodeLinks,
} from './communityNodes';
import { mergeEntries, parseSyncedState, type SyncedState } from './syncedEntries';

const PUSH_DELAY_MS = 1500;

interface SyncedCommunity {
  readonly version: 1;
  readonly installed: SyncedState<InstalledRef>;
  readonly links: SyncedState<NodeLink>;
}

function parseRef(v: unknown): InstalledRef | null {
  const version = (v as { version?: unknown } | null)?.version;
  return typeof version === 'number' && Number.isSafeInteger(version) && version >= 1
    ? { version }
    : null;
}

/** The account's value, validated (empty when absent or unreadable). */
export function parseSyncedCommunity(raw: unknown): SyncedCommunity {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    version: 1,
    installed: parseSyncedState(o.installed, parseRef),
    links: parseSyncedState(o.links, parseNodeLink),
  };
}

export class CommunitySync {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private again = false;
  /** Local changes made by the sync itself are not pushed back. */
  private applying = false;

  constructor(
    private readonly cloud: Cloud,
    private readonly installed: InstalledNodes,
    private readonly links: NodeLinks,
    /** A community node's page (its package), or null when it is not online any more. */
    private readonly fetchNode: (id: string) => Promise<CommunitySystem | null>,
  ) {}

  /** A local change: sync soon (signed in only). */
  schedule(): void {
    if (this.applying || !this.cloud.user) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), PUSH_DELAY_MS);
  }

  /** Pulls, merges and pushes back when the account is behind. Never runs twice at once. */
  async sync(): Promise<void> {
    if (!this.cloud.user) return;
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
    });
    await this.running;
    if (this.again) {
      this.again = false;
      await this.sync();
    }
  }

  private async run(): Promise<void> {
    try {
      const remote = parseSyncedCommunity(
        (await call<{ value: unknown }>('user-data/community')).value,
      );
      this.applying = true;
      try {
        await this.applyInstalled(remote.installed);
        const links = mergeEntries(this.links.syncState(), remote.links);
        this.links.applyRemote(links.set, links.remove);
      } finally {
        this.applying = false;
      }
      const local: SyncedCommunity = {
        version: 1,
        installed: this.installed.syncState(),
        links: this.links.syncState(),
      };
      if (JSON.stringify(local) !== JSON.stringify(remote))
        await call('user-data/community', {
          method: 'PUT',
          body: JSON.stringify({ value: local }),
        });
    } catch {
      // Offline or older server: retried at the next library sync or change.
    }
  }

  /** Installs the account's newer nodes (downloaded from the community), removes uninstalled ones. */
  private async applyInstalled(remote: SyncedState<InstalledRef>): Promise<void> {
    const { set, remove } = mergeEntries(this.installed.syncState(), remote);
    for (const [id, at] of remove) if (this.installed.get(id)) this.installed.remove(id, at);
    for (const [id, entry] of set) {
      const local = this.installed.get(id);
      if (local && local.version >= entry.value.version) continue;
      // Network errors abort the whole sync (nothing is pushed, so nothing is lost).
      const system = await this.fetchNode(id);
      // Deleted from the community: not installed here, and not listed in the push.
      if (!system) continue;
      const node: InstalledNode = {
        id: system.id,
        version: system.version,
        name: system.name,
        author: system.author,
        description: system.description,
        thumb: system.thumb,
        document: system.document,
      };
      this.installed.install(node, entry.updated);
    }
  }
}
