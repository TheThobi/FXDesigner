import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Community } from '../../src/app/community';
import { Cloud } from '../../src/app/cloud';
import { contentHash, Library } from '../../src/app/library';

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal('window', new EventTarget());
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const json = (body: unknown) => new Response(JSON.stringify(body));
const publication = { id: 'abcdef012345', version: 2, hash: contentHash({ n: 1 }) };

describe('publication persistence', () => {
  it('keeps legacy links without a version across reloads', () => {
    const lib = new Library();
    const entry = lib.create('Fire', { n: 1 });
    localStorage.setItem(
      'ptm.library.index',
      JSON.stringify([{ ...entry, published: { id: publication.id, hash: publication.hash } }]),
    );
    const restored = new Library();
    expect(restored.get(entry.id)?.published).toEqual({ ...publication, version: null });
    expect(restored.publishState(entry.id)).toBe('published');
    restored.save(entry.id, { n: 2 });
    expect(new Library().publishState(entry.id)).toBe('modified');
  });

  it('preserves omitted links from old servers but respects explicit unlinking', () => {
    const lib = new Library();
    const entry = lib.create('Fire', { n: 1 });
    lib.setPublished(entry.id, publication);
    lib.applyRemoteSystem({ ...entry, updated: entry.updated + 1 }, { n: 2 });
    expect(lib.get(entry.id)?.published).toEqual(publication);
    lib.applyRemoteSystem({ ...entry, published: null }, { n: 3 });
    expect(lib.get(entry.id)?.published).toBeNull();
  });

  it('does not overwrite a publication made while a sync download was in flight', async () => {
    let now = 1;
    const lib = new Library(() => now);
    const entry = lib.create('Fire', { n: 1 });
    const cloud = new Cloud(lib);
    cloud.user = { id: 'user', pseudo: 'Test', email: null, discord: false, password: true };
    let fetched!: () => void;
    const started = new Promise<void>((resolve) => {
      fetched = resolve;
    });
    let finish!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const remote = { ...entry, updated: 2, published: null, document: { n: 0 } };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === 'api/library') return json({ folders: [], systems: [remote], tombstones: [] });
        if (url === `api/library/systems/${entry.id}`) {
          fetched();
          return response;
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const syncing = cloud.sync();
    await started;
    now = 3;
    lib.setPublished(entry.id, publication);
    finish(json(remote));
    await syncing;
    expect(lib.get(entry.id)?.published).toEqual(publication);
    expect(lib.load(entry.id)).toEqual({ n: 1 });
  });
});

describe('publication responses', () => {
  it('fetches the version when an older server only acknowledges the update', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ version: 3 }));
    vi.stubGlobal('fetch', fetch);
    expect(await new Community().update(publication.id, {}, { n: 2 })).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps a successful publication usable when the version lookup fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ id: publication.id }))
        .mockRejectedValueOnce(new Error('Offline')),
    );
    expect(
      await new Community().publish(
        { name: 'Fire', description: '', category: 'other', tags: [] },
        { n: 1 },
        { animated: false, thumb: null, preview: null, previewFrames: 0 },
      ),
    ).toEqual({ id: publication.id, version: null });
  });

  it('uses a valid response directly', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ version: 4 }));
    vi.stubGlobal('fetch', fetch);
    expect(await new Community().update(publication.id, {}, { n: 2 })).toBe(4);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
