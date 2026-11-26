import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cloud } from '../../src/app/cloud';
import type { CommunitySystem } from '../../src/app/community';
import { InstalledNodes, NodeLinks } from '../../src/app/communityNodes';
import { CommunitySync, parseSyncedCommunity } from '../../src/app/communitySync';
import { mergeEntries } from '../../src/app/syncedEntries';

/** One browser's localStorage. */
function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

const link = { id: 'abcdef012345', name: 'Aurora', version: 1, hash: 'h1' };

describe('per-entry merge', () => {
  it('takes the newest write per key, tombstones included', () => {
    const local = {
      entries: { a: { value: 1, updated: 10 }, b: { value: 2, updated: 10 } },
      removed: { c: 30 },
    };
    const remote = {
      entries: {
        a: { value: 9, updated: 20 },
        b: { value: 8, updated: 5 },
        c: { value: 7, updated: 20 },
      },
      removed: { b: 15, d: 40 },
    };
    const { set, remove } = mergeEntries(local, remote);
    // a: remote newer; b: removed remotely after the local write; c: removed here last.
    expect(set).toEqual([['a', { value: 9, updated: 20 }]]);
    expect(remove).toEqual([
      ['b', 15],
      ['d', 40],
    ]);
  });

  it('reads broken account values as empty', () => {
    const empty = parseSyncedCommunity(null);
    expect(empty.installed.entries).toEqual({});
    const parsed = parseSyncedCommunity({
      installed: { entries: { x: { value: { version: 0 }, updated: 1 } }, removed: { y: 'no' } },
      links: { entries: { 's/n1': { value: link, updated: 2 } } },
    });
    expect(parsed.installed.entries).toEqual({});
    expect(parsed.installed.removed).toEqual({});
    expect(parsed.links.entries['s/n1']).toEqual({ value: link, updated: 2 });
  });
});

describe('community sync across devices', () => {
  let server: unknown = null;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    server = null;
    fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        server = (JSON.parse(String(init.body)) as { value: unknown }).value;
        return new Response('{"ok":true}');
      }
      return new Response(JSON.stringify({ value: server }));
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => vi.unstubAllGlobals());

  const online: CommunitySystem = {
    id: 'abcdef012345',
    kind: 'node',
    name: 'Aurora',
    description: '',
    category: 'magic',
    tags: [],
    thumb: null,
    animated: false,
    previewFrames: 0,
    version: 2,
    uses: 0,
    created: 0,
    updated: 0,
    author: 'Test',
    mine: true,
    subscribers: 0,
    subscribed: false,
    hidden: false,
    document: { pkg: 1 },
  };
  const cloud = { user: { id: 'u' } } as unknown as Cloud;

  /** A device: its own storage, stores and sync. */
  function device(fetchNode = async (): Promise<CommunitySystem | null> => online) {
    vi.stubGlobal('localStorage', storage());
    const installed = new InstalledNodes();
    const links = new NodeLinks();
    return { installed, links, sync: new CommunitySync(cloud, installed, links, fetchNode) };
  }

  it('installs on the other device, links follow, uninstalls travel', async () => {
    const t = Date.now();
    const a = device();
    a.installed.install({ ...online, document: online.document }, t);
    a.links.set('sys1', 'n4', link, t);
    await a.sync.sync();

    const b = device();
    await b.sync.sync();
    // Downloaded again from the community (its current version).
    expect(b.installed.get('abcdef012345')).toMatchObject({ version: 2, name: 'Aurora' });
    expect(b.links.get('sys1', 'n4')).toEqual(link);

    b.installed.remove('abcdef012345', t + 200);
    await b.sync.sync();
    vi.stubGlobal('localStorage', storage());
    const c = device();
    await c.sync.sync();
    expect(c.installed.list()).toEqual([]);
  });

  it('pushes nothing when a node cannot be downloaded for now', async () => {
    const a = device();
    a.installed.install({ ...online }, 100);
    await a.sync.sync();
    const before = JSON.stringify(server);
    const b = device(async () => {
      throw new Error('offline');
    });
    b.links.set('sys2', 'n1', { ...link, id: 'bbbbbbbbbbbb' }, 300);
    await b.sync.sync();
    expect(JSON.stringify(server)).toBe(before);
  });
});
