import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InstalledNodes,
  isCustomShaderNode,
  nodeFromPackage,
  nodePackage,
  NodeLinks,
  packageHash,
} from '../../src/app/communityNodes';
import { createNode } from '../../src/app/state';
import type { ShaderGenerator } from '../../src/engine/generator';
import { getGenerator } from '../../src/generators/registry';

const noise = getGenerator('fractal-noise') as ShaderGenerator;
const custom = getGenerator('custom-shader')!;

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('community shader nodes', () => {
  it('only shares custom shader nodes', () => {
    const plain = createNode(noise, 'n3', 10, 20);
    expect(isCustomShaderNode(plain, noise)).toBe(false);
    expect(isCustomShaderNode({ ...plain, code: noise.fragment }, noise)).toBe(false);
    expect(
      isCustomShaderNode({ ...plain, code: 'vec4 generate(vec2 uv) { return vec4(1.0); }' }, noise),
    ).toBe(true);
    expect(isCustomShaderNode(createNode(custom, 'n1', 0, 0), custom)).toBe(true);
    expect(isCustomShaderNode(plain, getGenerator('reaction-diffusion'))).toBe(false);
  });

  it('packs one node with its code and unpacks it validated', () => {
    const code = 'vec4 generate(vec2 uv) { return vec4(u_glow); }';
    const node = {
      ...createNode(noise, 'n7', 300, -40),
      collapsed: true,
      frozenAt: 2,
      code,
      customParams: [
        {
          key: 'glow',
          label: 'Glow',
          type: 'float' as const,
          min: 0,
          max: 2,
          default: 1,
          group: '',
        },
      ],
      params: { ...createNode(noise, 'n7', 0, 0).params, glow: 1.5 },
    };
    const pkg = nodePackage(node, getGenerator, 42) as { nodes: unknown[]; links: unknown[] };
    expect(pkg.nodes).toHaveLength(1);
    expect(pkg.links).toEqual([]);
    const back = nodeFromPackage(JSON.parse(JSON.stringify(pkg)), getGenerator);
    expect(back).toMatchObject({ generator: 'fractal-noise', x: 0, y: 0, frozenAt: null, code });
    expect(back.collapsed).toBeUndefined();
    expect(back.customParams?.[0]?.key).toBe('glow');
    expect(back.params.glow).toBe(1.5);

    // The Custom Shader's own code is always included (the server requires code).
    const plain = nodePackage(createNode(custom, 'n1', 0, 0), getGenerator, 0) as {
      nodes: { code?: string }[];
    };
    expect(plain.nodes[0]!.code).toContain('generate');
  });

  it('rejects packages that are not a single shader node', () => {
    expect(() => nodeFromPackage({ nope: true }, getGenerator)).toThrow();
    const sim = createNode(getGenerator('reaction-diffusion')!, 'n1', 0, 0);
    const doc = {
      format: 'fx-designer',
      version: 8,
      nodes: [sim],
      links: [],
      selected: 'n1',
      resolution: 512,
      seed: 0,
      aspect: 1,
    };
    expect(() => nodeFromPackage(doc, getGenerator)).toThrow('Not a shader node package');
  });

  it('keeps installed nodes across reloads, one entry per community id', () => {
    const store = new InstalledNodes();
    const changes = vi.fn();
    store.onChange = changes;
    const entry = {
      id: 'abcdef012345',
      version: 1,
      name: 'Aurora',
      author: 'Test',
      description: '',
      thumb: 'data:image/webp;base64,AAAA',
      document: { n: 1 },
    };
    store.install(entry);
    store.install({ ...entry, version: 2, thumb: `data:image/png;base64,${'A'.repeat(200_000)}` });
    expect(changes).toHaveBeenCalledTimes(2);
    const reloaded = new InstalledNodes();
    expect(reloaded.list()).toHaveLength(1);
    expect(reloaded.get('abcdef012345')).toMatchObject({ version: 2, thumb: null });
    expect(reloaded.byTileId('community:abcdef012345')?.name).toBe('Aurora');
    expect(reloaded.byTileId('fractal-noise')).toBeUndefined();
    reloaded.remove('abcdef012345');
    expect(new InstalledNodes().list()).toEqual([]);
  });

  it('links published nodes per system, ignoring the workspace seed in hashes', () => {
    const node = { ...createNode(custom, 'n2', 0, 0) };
    expect(packageHash(nodePackage(node, getGenerator, 1))).toBe(
      packageHash(nodePackage(node, getGenerator, 99)),
    );
    const edited = { ...node, code: 'vec4 generate(vec2 uv) { return vec4(0.0); }' };
    expect(packageHash(nodePackage(edited, getGenerator, 1))).not.toBe(
      packageHash(nodePackage(node, getGenerator, 1)),
    );

    const links = new NodeLinks();
    const link = { id: 'abcdef012345', name: 'Aurora', version: 1, hash: 'h' };
    links.set('sys1', 'n2', link);
    // One graph node per community node: linking another node moves the link.
    links.set('sys1', 'n5', { ...link, version: 2 });
    const reloaded = new NodeLinks();
    expect(reloaded.get('sys1', 'n2')).toBeNull();
    expect(reloaded.get('sys1', 'n5')).toEqual({ ...link, version: 2 });
    expect([...reloaded.ofSystem('sys1').keys()]).toEqual(['n5']);
    expect(reloaded.ofSystem('sys2').size).toBe(0);
    reloaded.forget('abcdef012345');
    expect(new NodeLinks().get('sys1', 'n5')).toBeNull();
  });
});
