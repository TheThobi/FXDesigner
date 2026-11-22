import { beforeEach, describe, expect, it } from 'vitest';
import { contentHash, Library } from '../../src/app/library';
import { rectMinusHoles } from '../../src/ui/Viewport';

describe('system library', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  it('creates, saves, renames, duplicates and removes systems, and persists them', () => {
    let clock = 1000;
    const lib = new Library(() => clock++);
    const a = lib.create('Fire', { nodes: ['a'] });
    const b = lib.create('Fire', { nodes: ['b'] });
    expect(b.name).toBe('Fire 2');
    lib.setCurrent(a.id);
    lib.save(a.id, { nodes: ['a2'] }, 'data:image/png;base64,AAAA');

    const reloaded = new Library();
    expect(reloaded.currentId).toBe(a.id);
    expect(reloaded.load(a.id)).toEqual({ nodes: ['a2'] });
    expect(reloaded.get(a.id)?.thumb).toBe('data:image/png;base64,AAAA');
    // Most recently saved first.
    expect(reloaded.list().map((e) => e.id)).toEqual([a.id, b.id]);

    lib.rename(b.id, '  ');
    expect(lib.get(b.id)?.name).toBe('Untitled system');
    const copy = lib.duplicate(a.id)!;
    expect(copy.name).toBe('Fire copy');
    expect(lib.load(copy.id)).toEqual({ nodes: ['a2'] });

    lib.remove(a.id);
    expect(lib.load(a.id)).toBeNull();
    expect(new Library().currentId).toBeNull();
  });

  it('tells local, published and modified systems apart', () => {
    const lib = new Library();
    const doc = { nodes: [{ id: 'n1' }], selected: 'n1' };
    const a = lib.create('Fire', doc);
    expect(lib.publishState(a.id)).toBe('local');
    lib.setPublished(a.id, { id: 'abcdef012345', version: 1, hash: contentHash(doc) });
    expect(lib.publishState(a.id)).toBe('published');
    // The selection is not content.
    lib.save(a.id, { ...doc, selected: 'n2' });
    expect(lib.publishState(a.id)).toBe('published');
    lib.save(a.id, { nodes: [{ id: 'n1' }, { id: 'n2' }], selected: 'n1' });
    expect(lib.publishState(a.id)).toBe('modified');
    expect(new Library().get(a.id)?.published?.id).toBe('abcdef012345');
    expect(lib.findPublished('abcdef012345')?.id).toBe(a.id);
    // A duplicate is a new, local system.
    expect(lib.publishState(lib.duplicate(a.id)!.id)).toBe('local');
    lib.setPublished(a.id, null);
    expect(lib.publishState(a.id)).toBe('local');
  });

  it('sorts systems into folders and reports local changes only', () => {
    const changes: string[] = [];
    const lib = new Library();
    lib.onChange = (c) => changes.push(`${c.kind}:${c.id}`);
    const folder = lib.createFolder('Fire');
    const sys = lib.create('Torch', { n: 1 }, folder.id);
    expect(lib.get(sys.id)?.folder).toBe(folder.id);
    lib.move(sys.id, null);
    expect(lib.get(sys.id)?.folder).toBeNull();
    lib.move(sys.id, folder.id);
    lib.removeFolder(folder.id);
    expect(lib.get(sys.id)?.folder).toBeNull();
    expect(changes).toContain(`folder-removed:${folder.id}`);
    // Server data is applied without echoing a change back.
    changes.length = 0;
    lib.applyRemoteSystem(
      { id: 'sremote', name: 'Remote', updated: 5, thumb: null, folder: null },
      { n: 2 },
    );
    lib.applyRemoteRemoval('system', sys.id);
    expect(changes).toEqual([]);
    expect(lib.load('sremote')).toEqual({ n: 2 });
    expect(lib.get(sys.id)).toBeUndefined();
  });

  it('ignores a corrupted index', () => {
    localStorage.setItem('ptm.library.index', '{oops');
    expect(new Library().list()).toEqual([]);
  });
});

describe('card occlusion', () => {
  it('returns the outer rect when nothing covers it', () => {
    expect(rectMinusHoles([0, 0, 10, 10], [])).toBe('M0 0H10V10H0Z');
  });

  it('cuts overlapping holes once (no even-odd re-inclusion)', () => {
    const d = rectMinusHoles(
      [0, 0, 10, 10],
      [
        [2, 2, 6, 6],
        [4, 4, 8, 8],
      ],
    );
    // Area left = 100 - union(16 + 16 - 4) = 72.
    let area = 0;
    for (const m of d.matchAll(/M([\d.-]+) ([\d.-]+)H([\d.-]+)V([\d.-]+)/g))
      area += (Number(m[3]) - Number(m[1])) * (Number(m[4]) - Number(m[2]));
    expect(area).toBe(72);
  });
});
