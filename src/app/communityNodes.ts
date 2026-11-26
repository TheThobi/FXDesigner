/**
 * Custom shader nodes shared in the community. A node package is an FX Designer document
 * holding one node (its generator, edited GLSL, custom / edited parameters, values, Post
 * Process look and ramp) and no links: it is validated and migrated like any document.
 *
 * Installed nodes are kept in localStorage with their community version; the generator
 * browser lists them in a "Community" section (tile id `community:<id>`), where they are
 * added or swapped in like generators.
 */
import type { GeneratorDefinition } from '../engine/generator';
import { readStorage, writeStorage } from '../util/storage';
import { documentFromState, parseDocument, type GeneratorLookup } from './document';
import { contentHash } from './library';
import { codeDiffers, type GraphNode } from './state';
import { parseSyncedState, pruneRemoved, type Stamped, type SyncedState } from './syncedEntries';

/** Tile ids of installed nodes in the generator browser. */
export const COMMUNITY_NODE_PREFIX = 'community:';
const STORAGE_KEY = 'ptm.community.nodes';
const MAX_INSTALLED = 200;
/** Thumbnails larger than this are not kept (the tile shows a glyph instead). */
const MAX_STORED_THUMB = 96 * 1024;

export interface InstalledNode {
  /** Community id. */
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly author: string;
  readonly description: string;
  readonly thumb: string | null;
  /** The node package (validated again on every use). */
  readonly document: unknown;
  /** When it was installed or updated here (sync with the account). */
  readonly updated?: number;
}

/** Whether `node` is a custom shader node that can be published as a node package. */
export function isCustomShaderNode(node: GraphNode, def: GeneratorDefinition | undefined): boolean {
  if (!def || def.kind !== 'shader' || def.codeParam || def.role) return false;
  return (
    def.id === 'custom-shader' ||
    (node.code !== undefined && codeDiffers(node.code, def.fragment)) ||
    (node.customParams?.length ?? 0) > 0
  );
}

/** The package published for `node`: a one-node document, its code always included. */
export function nodePackage(node: GraphNode, lookup: GeneratorLookup, seed: number): unknown {
  const def = lookup(node.generator);
  if (!def || def.kind !== 'shader') throw new Error('Only shader nodes can be shared');
  const { collapsed: _collapsed, ...rest } = node;
  const packed: GraphNode = {
    ...rest,
    id: 'n1',
    x: 0,
    y: 0,
    frozenAt: null,
    code: node.code ?? def.fragment.replace(/\r\n?/g, '\n'),
  };
  return documentFromState(
    { nodes: [packed], links: [], selectedId: 'n1', resolution: 512, seed, aspect: 1 },
    lookup,
  );
}

/** The node of a package (validated), or an error when it is not a single shader node. */
export function nodeFromPackage(raw: unknown, lookup: GeneratorLookup): GraphNode {
  const doc = parseDocument(raw, lookup);
  const node = doc.nodes[0]!;
  if (doc.nodes.length !== 1 || lookup(node.generator)?.kind !== 'shader')
    throw new Error('Not a shader node package');
  return node;
}

function parseInstalled(raw: unknown): InstalledNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.version !== 'number')
    return null;
  return {
    id: o.id,
    version: o.version,
    name: o.name.slice(0, 64),
    author: typeof o.author === 'string' ? o.author : '',
    description: typeof o.description === 'string' ? o.description : '',
    thumb: typeof o.thumb === 'string' && o.thumb.startsWith('data:image/') ? o.thumb : null,
    document: o.document,
    updated: typeof o.updated === 'number' ? o.updated : 0,
  };
}

/** What syncs of an installed node: the document comes back from the community. */
export interface InstalledRef {
  readonly version: number;
}

const REMOVED_KEY = 'ptm.community.nodes.removed';

function readRemoved(key: string): Record<string, number> {
  try {
    return parseSyncedState(
      { entries: {}, removed: JSON.parse(readStorage(key) ?? '{}') as unknown },
      () => null,
    ).removed as Record<string, number>;
  } catch {
    return {};
  }
}

export class InstalledNodes {
  private items: InstalledNode[] = [];
  /** Uninstalled ids -> when (synced tombstones). */
  private removed: Record<string, number> = readRemoved(REMOVED_KEY);
  /** Called after every change. */
  onChange: (() => void) | null = null;

  constructor() {
    try {
      const raw: unknown = JSON.parse(readStorage(STORAGE_KEY) ?? '[]');
      if (Array.isArray(raw))
        this.items = raw.map(parseInstalled).filter((n): n is InstalledNode => n !== null);
    } catch {
      // Corrupted storage: nothing installed.
    }
  }

  list(): readonly InstalledNode[] {
    return this.items;
  }

  get(id: string): InstalledNode | undefined {
    return this.items.find((n) => n.id === id);
  }

  /** Installed node behind a generator browser tile id, if it is one. */
  byTileId(tileId: string): InstalledNode | undefined {
    return tileId.startsWith(COMMUNITY_NODE_PREFIX)
      ? this.get(tileId.slice(COMMUNITY_NODE_PREFIX.length))
      : undefined;
  }

  /** Installs `node`, or replaces its installed version (`updated`: when, for the sync). */
  install(node: InstalledNode, updated = Date.now()): void {
    const thumb = node.thumb && node.thumb.length <= MAX_STORED_THUMB ? node.thumb : null;
    const others = this.items.filter((n) => n.id !== node.id);
    this.items = [...others, { ...node, thumb, updated }].slice(-MAX_INSTALLED);
    delete this.removed[node.id];
    this.persist();
  }

  remove(id: string, at = Date.now()): void {
    this.items = this.items.filter((n) => n.id !== id);
    this.removed[id] = at;
    this.persist();
  }

  /** Ids, versions and tombstones, as synced with the account. */
  syncState(): SyncedState<InstalledRef> {
    return {
      entries: Object.fromEntries(
        this.items.map((n) => [n.id, { value: { version: n.version }, updated: n.updated ?? 0 }]),
      ),
      removed: pruneRemoved(this.removed),
    };
  }

  private persist(): void {
    writeStorage(STORAGE_KEY, JSON.stringify(this.items));
    writeStorage(REMOVED_KEY, JSON.stringify(pruneRemoved(this.removed)));
    this.onChange?.();
  }
}

/** Hash of a node package's content (the workspace seed it was packed with is ignored). */
export function packageHash(pkg: unknown): string {
  return contentHash(pkg && typeof pkg === 'object' ? { ...pkg, seed: 0 } : pkg);
}

/** A graph node published as a community node by its author. */
export interface NodeLink {
  /** Community id. */
  readonly id: string;
  /** Name of the publication (shown in hints). */
  readonly name: string;
  readonly version: number | null;
  /** `packageHash` of the published package: differs once the node was edited. */
  readonly hash: string;
}

const LINKS_KEY = 'ptm.community.nodeLinks';
const LINKS_REMOVED_KEY = 'ptm.community.nodeLinks.removed';

/** A stored link, or null when invalid. */
export function parseNodeLink(v: unknown): NodeLink | null {
  const o = v as Partial<NodeLink> | null;
  if (!o || typeof o !== 'object' || typeof o.id !== 'string' || typeof o.hash !== 'string')
    return null;
  return {
    id: o.id,
    name: typeof o.name === 'string' ? o.name : 'Shader node',
    version: typeof o.version === 'number' ? o.version : null,
    hash: o.hash,
  };
}

/**
 * Which graph nodes are your published community nodes, per library system
 * (`<systemId>/<nodeId>`). Kept outside documents: a copied or duplicated node is a new node,
 * not linked, and publishing a node never changes its system's content hash. Synced with the
 * account (communitySync.ts) like the library, so another device updates the same
 * publication instead of publishing a duplicate.
 */
export class NodeLinks {
  private links: Record<string, Stamped<NodeLink>> = {};
  private removed: Record<string, number> = readRemoved(LINKS_REMOVED_KEY);
  /** Called after every change. */
  onChange: (() => void) | null = null;

  constructor() {
    try {
      const raw: unknown = JSON.parse(readStorage(LINKS_KEY) ?? '{}');
      if (raw && typeof raw === 'object' && !Array.isArray(raw))
        for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
          // Stored as { value, updated }; links saved before the sync are bare (time 0).
          const stamped = v as Partial<Stamped<unknown>> | null;
          const link = parseNodeLink(stamped && 'value' in stamped ? stamped.value : v);
          if (link)
            this.links[key] = {
              value: link,
              updated: typeof stamped?.updated === 'number' ? stamped.updated : 0,
            };
        }
    } catch {
      // Corrupted storage: no links.
    }
  }

  get(systemId: string, nodeId: string): NodeLink | null {
    return this.links[`${systemId}/${nodeId}`]?.value ?? null;
  }

  /** Links of the nodes of system `systemId`, by node id. */
  ofSystem(systemId: string): Map<string, NodeLink> {
    const prefix = `${systemId}/`;
    return new Map(
      Object.entries(this.links)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, link]) => [key.slice(prefix.length), link.value]),
    );
  }

  /** Links node `nodeId` of `systemId` to `link` (one graph node per community node). */
  set(systemId: string, nodeId: string, link: NodeLink, updated = Date.now()): void {
    const key = `${systemId}/${nodeId}`;
    for (const [k, l] of Object.entries(this.links))
      if (l.value.id === link.id && k !== key) this.drop(k, updated);
    this.links[key] = { value: link, updated };
    delete this.removed[key];
    this.persist();
  }

  /** Community node `id` was deleted: nothing is linked to it any more. */
  forget(id: string): void {
    const at = Date.now();
    for (const [key, l] of Object.entries(this.links)) if (l.value.id === id) this.drop(key, at);
    this.persist();
  }

  /** Links and tombstones, as synced with the account. */
  syncState(): SyncedState<NodeLink> {
    return { entries: { ...this.links }, removed: pruneRemoved(this.removed) };
  }

  /** Applies the account's newer entries (from mergeEntries). */
  applyRemote(set: readonly [string, Stamped<NodeLink>][], remove: readonly [string, number][]) {
    if (!set.length && !remove.length) return;
    for (const [key, entry] of set) {
      this.links[key] = entry;
      delete this.removed[key];
    }
    for (const [key, at] of remove) this.drop(key, at);
    this.persist();
  }

  private drop(key: string, at: number): void {
    delete this.links[key];
    this.removed[key] = at;
  }

  private persist(): void {
    writeStorage(LINKS_KEY, JSON.stringify(this.links));
    writeStorage(LINKS_REMOVED_KEY, JSON.stringify(pruneRemoved(this.removed)));
    this.onChange?.();
  }
}
