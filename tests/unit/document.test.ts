import { describe, expect, it } from 'vitest';
import {
  applyDocument,
  decodeDocumentFromUrl,
  documentFromState,
  DocumentError,
  DOCUMENT_FORMAT,
  DOCUMENT_VERSION,
  encodeDocumentForUrl,
  parseDocument,
} from '../../src/app/document';
import { createNode, type EditorState } from '../../src/app/state';
import { getGenerator } from '../../src/generators/registry';

const noise = getGenerator('fractal-noise')!;
const blend = getGenerator('op-blend')!;

const state: EditorState = {
  nodes: [
    {
      ...createNode(noise, 'n1', 0, 0),
      params: {
        noiseType: 2,
        scale: 7,
        octaves: 3,
        lacunarity: 2,
        gain: 0.5,
        tileable: true,
        speed: 0,
      },
    },
    createNode(blend, 'n2', 400, 0),
  ],
  links: [{ from: 'n1', to: 'n2', input: 'foreground' }],
  selectedId: 'n2',
  resolution: 1024,
  seed: 42,
  aspect: 1,
};

describe('document round trip', () => {
  it('survives serialize -> URL encode -> decode -> parse', () => {
    const doc = documentFromState(state, getGenerator);
    const parsed = parseDocument(decodeDocumentFromUrl(encodeDocumentForUrl(doc)), getGenerator);
    expect(parsed).toEqual(doc);
    expect(parsed.nodes[0]!.params.scale).toBe(7);
    expect(parsed.nodes[0]!.post.colorMode).toBeDefined();
    expect(parsed.links).toEqual(state.links);
    expect(parsed.selected).toBe('n2');
  });

  it('replaces the whole graph when applied', () => {
    const doc = documentFromState(state, getGenerator);
    const applied = applyDocument(doc);
    expect(applied.nodes.map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(applied.selectedId).toBe('n2');
  });

  it('encodes unicode text safely', () => {
    const rd = getGenerator('reaction-diffusion')!;
    const node = { ...createNode(rd, 'n1', 0, 0), params: { seedText: 'Ωé✓' } };
    const s: EditorState = { ...state, nodes: [node], links: [], selectedId: 'n1' };
    const doc = documentFromState(s, getGenerator);
    const back = parseDocument(decodeDocumentFromUrl(encodeDocumentForUrl(doc)), getGenerator);
    expect(back.nodes[0]!.params.seedText).toBe('Ωé✓');
  });
});

describe('parseDocument validation', () => {
  const v1 = {
    format: DOCUMENT_FORMAT,
    version: 1,
    generator: 'glow',
    params: {},
    post: {},
    resolution: 512,
    seed: 3,
  };

  it('rejects foreign or future documents', () => {
    expect(() => parseDocument({ ...v1, format: 'other' }, getGenerator)).toThrow(DocumentError);
    expect(() => parseDocument({ ...v1, version: 99 }, getGenerator)).toThrow(DocumentError);
    expect(() => parseDocument({ ...v1, generator: 'nope' }, getGenerator)).toThrow(DocumentError);
    expect(() => parseDocument('x', getGenerator)).toThrow(DocumentError);
  });

  it('sanitizes values, resolution and seed', () => {
    const doc = parseDocument(
      { ...v1, params: { radius: 99 }, resolution: 700, seed: -5 },
      getGenerator,
    );
    expect(doc.nodes[0]!.params.radius).toBeCloseTo(1.5 + 1.45 * 3);
    expect(doc.resolution).toBe(512);
    expect(doc.seed).toBe(0);
  });

  it('fills post defaults from the generator', () => {
    const doc = parseDocument({ ...v1, generator: 'flame' }, getGenerator);
    expect(doc.nodes[0]!.post.alphaMode).toBe(1);
  });

  it('drops unknown nodes, invalid links and cycles', () => {
    const node = (id: string, generator = 'op-blend') => ({ id, generator, x: 0, y: 0 });
    const doc = parseDocument(
      {
        format: DOCUMENT_FORMAT,
        version: 5,
        nodes: [node('a'), node('b'), node('c', 'nope'), node('a')],
        links: [
          { from: 'a', to: 'b', input: 'foreground' },
          { from: 'b', to: 'a', input: 'foreground' }, // cycle
          { from: 'c', to: 'a', input: 'mask' }, // unknown node
          { from: 'a', to: 'b', input: 'nope' }, // unknown input
        ],
        selected: 'zzz',
        resolution: 512,
        seed: 1,
      },
      getGenerator,
    );
    expect(doc.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(doc.links).toEqual([{ from: 'a', to: 'b', input: 'foreground' }]);
    expect(doc.selected).toBe('a');
  });

  it('rejects corrupted share links', () => {
    expect(() => decodeDocumentFromUrl('%%%')).toThrow(DocumentError);
  });
});

describe('migrations', () => {
  it('v1: legacy post values become modules, the gradient becomes the ramp', () => {
    const doc = parseDocument(
      {
        format: DOCUMENT_FORMAT,
        version: 1,
        generator: 'flame',
        params: {},
        post: {
          posterize: 4,
          outline: 0,
          pixelate: 32,
          contrast: 1.5,
          strokes: 0.4,
          gradient: {
            stops: [
              { pos: 0, color: '#000000', alpha: 1 },
              { pos: 1, color: '#ff0000', alpha: 1 },
            ],
          },
        },
        resolution: 512,
        seed: 1,
      },
      getGenerator,
    );
    expect(doc.version).toBe(DOCUMENT_VERSION);
    const node = doc.nodes[0]!;
    expect(node.generator).toBe('flame');
    expect(node.post.posterizeOn).toBe(true);
    expect(node.post.posterize).toBe(4);
    expect(node.post.outlineOn).toBe(false);
    expect(node.post.pixelateOn).toBe(true);
    expect(node.post.levelsOn).toBe(true);
    expect('overrideRamp' in node.post).toBe(false);
    expect('strokes' in node.post).toBe(false);
    expect(node.ramp.stops.at(-1)?.color).toBe('#ff0000');
  });

  it('v3: the single generator becomes the only, selected node', () => {
    const doc = parseDocument(
      {
        format: DOCUMENT_FORMAT,
        version: 3,
        generator: 'glow',
        params: { radius: 0.4 },
        post: { posterizeOn: true },
        ramp: { stops: [{ pos: 0, color: '#123456', alpha: 1 }] },
        resolution: 256,
        seed: 9,
      },
      getGenerator,
    );
    expect(doc.nodes).toHaveLength(1);
    expect(doc.selected).toBe(doc.nodes[0]!.id);
    expect(doc.nodes[0]!.params.radius).toBe(0.4);
    expect(doc.nodes[0]!.post.posterizeOn).toBe(true);
    expect(doc.nodes[0]!.ramp.stops[0]!.color).toBe('#123456');
    expect(doc.nodes[0]!.postEnabled).toBe(true);
    expect(doc.links).toEqual([]);
    expect(doc.seed).toBe(9);
  });
});

describe('node extras', () => {
  it('round-trips freeze and the workspace aspect', () => {
    const node = { ...createNode(noise, 'n1', 0, 0), frozenAt: 1.25 };
    const s: EditorState = { ...state, nodes: [node], links: [], selectedId: 'n1', aspect: 0.5 };
    const back = parseDocument(
      decodeDocumentFromUrl(encodeDocumentForUrl(documentFromState(s, getGenerator))),
      getGenerator,
    );
    expect(back.aspect).toBe(0.5);
    expect(back.nodes[0]!.frozenAt).toBe(1.25);
  });

  it('falls back to defaults for unknown aspects and missing extras', () => {
    const doc = parseDocument(
      {
        format: DOCUMENT_FORMAT,
        version: 5,
        nodes: [{ id: 'a', generator: 'glow', x: 0, y: 0 }],
        links: [],
        selected: 'a',
        resolution: 512,
        seed: 1,
        aspect: 7,
      },
      getGenerator,
    );
    expect(doc.aspect).toBe(1);
    expect(doc.nodes[0]!.frozenAt).toBeNull();
  });
});

describe('v4 -> v5: generic inputs and adjustments become operators', () => {
  it('rebuilds warp, base blend + mask and adjustments as an operator chain', () => {
    const doc = parseDocument(
      {
        format: DOCUMENT_FORMAT,
        version: 4,
        nodes: [
          { id: 'n1', generator: 'fractal-noise', x: 0, y: 0 },
          { id: 'n2', generator: 'cellular', x: 0, y: 400 },
          {
            id: 'n3',
            generator: 'glow',
            x: 400,
            y: 0,
            io: { blendMode: 2, blendOpacity: 0.5, maskInvert: true, warpAmount: 0.2 },
            adjust: { mathOn: true, fold: true, codeOn: true, code: 'v = sampleSource(uv);' },
          },
          { id: 'n4', generator: 'glow', x: 800, y: 0 },
        ],
        links: [
          { from: 'n1', to: 'n3', input: 'warp' },
          { from: 'n2', to: 'n3', input: 'base' },
          { from: 'n1', to: 'n3', input: 'mask' },
          { from: 'n3', to: 'n4', input: 'base' },
        ],
        selected: 'n3',
        resolution: 512,
        seed: 1,
      },
      getGenerator,
    );
    const gen = (id: string) => doc.nodes.find((n) => n.id === id)?.generator;
    const linkInto = (to: string, input: string) =>
      doc.links.find((l) => l.to === to && l.input === input)?.from;
    // n3 -> levels -> custom -> warp -> blend, in that order.
    const levels = doc.nodes.find((n) => n.generator === 'op-levels')!;
    const custom = doc.nodes.find((n) => n.generator === 'op-custom')!;
    const warp = doc.nodes.find((n) => n.generator === 'op-warp')!;
    const blends = doc.nodes.filter((n) => n.generator === 'op-blend');
    expect(linkInto(levels.id, 'image')).toBe('n3');
    expect(levels.params.fold).toBe(true);
    expect(linkInto(custom.id, 'a')).toBe(levels.id);
    expect(custom.params.code).toBe('v = a(uv);');
    expect(linkInto(warp.id, 'image')).toBe(custom.id);
    expect(linkInto(warp.id, 'warp')).toBe('n1');
    const blend = blends.find((b) => linkInto(b.id, 'foreground') === warp.id)!;
    expect(linkInto(blend.id, 'background')).toBe('n2');
    expect(linkInto(blend.id, 'mask')).toBe('n1');
    expect(blend.params.mode).toBe(3); // v4 Multiply
    expect(blend.params.invertMask).toBe(true);
    // n4's old Base link: a blend whose background is the end of n3's chain.
    const n4Blend = blends.find((b) => linkInto(b.id, 'foreground') === 'n4')!;
    expect(linkInto(n4Blend.id, 'background')).toBe(blend.id);
    expect(gen('n4')).toBe('glow');
    expect(doc.links.some((l) => ['base', 'warp'].includes(l.input) && l.to === 'n3')).toBe(false);
  });
});

describe('v5 -> v6: channel outputs', () => {
  const base = {
    format: 'procedural-texture-maker', // pre-rename format id, still accepted
    version: 5,
    selected: 'a',
    resolution: 512,
    seed: 1,
  };

  it('turns Channels into Unpack RGBA links from the chosen output', () => {
    const doc = parseDocument(
      {
        ...base,
        nodes: [
          { id: 'a', generator: 'fractal-noise', x: 0, y: 0 },
          { id: 'b', generator: 'op-channels', x: 0, y: 0, params: { channel: 1 } },
          { id: 'c', generator: 'op-blend', x: 0, y: 0 },
        ],
        links: [
          { from: 'a', to: 'b', input: 'image' },
          { from: 'b', to: 'c', input: 'mask' },
        ],
      },
      getGenerator,
    );
    expect(doc.format).toBe(DOCUMENT_FORMAT);
    expect(doc.nodes.find((n) => n.id === 'b')?.generator).toBe('op-unpack');
    expect(doc.links).toContainEqual({ from: 'b', to: 'c', input: 'mask', output: 'g' });
    expect(doc.links).toContainEqual({ from: 'a', to: 'b', input: 'image' });
  });

  it('turns the Luminance mode into Custom Code', () => {
    const doc = parseDocument(
      {
        ...base,
        nodes: [
          { id: 'a', generator: 'fractal-noise', x: 0, y: 0 },
          { id: 'b', generator: 'op-channels', x: 0, y: 0, params: { channel: 4 } },
        ],
        links: [{ from: 'a', to: 'b', input: 'image' }],
      },
      getGenerator,
    );
    const b = doc.nodes.find((n) => n.id === 'b')!;
    expect(b.generator).toBe('op-custom');
    expect(String(b.params.code)).toContain('luminance');
    expect(doc.links).toEqual([{ from: 'a', to: 'b', input: 'a' }]);
  });

  it('drops links naming an output their node does not have', () => {
    const doc = parseDocument(
      {
        ...base,
        format: DOCUMENT_FORMAT,
        version: DOCUMENT_VERSION,
        nodes: [
          { id: 'a', generator: 'fractal-noise', x: 0, y: 0 },
          { id: 'u', generator: 'op-unpack', x: 0, y: 0 },
          { id: 'c', generator: 'op-blend', x: 0, y: 0 },
        ],
        links: [
          { from: 'a', to: 'u', input: 'image', output: 'r' }, // noise has no channel outputs
          { from: 'u', to: 'c', input: 'mask' }, // unpack has no main output
          { from: 'u', to: 'c', input: 'foreground', output: 'a' },
        ],
      },
      getGenerator,
    );
    expect(doc.links).toEqual([{ from: 'u', to: 'c', input: 'foreground', output: 'a' }]);
  });
});

describe('v6 -> v7: Surface Wear split', () => {
  it('maps each surface mode to its own generator, keeping its values', () => {
    const wear = (id: string, params: Record<string, unknown>) => ({
      id,
      generator: 'surface-wear',
      x: 0,
      y: 0,
      params,
    });
    const doc = parseDocument(
      {
        format: DOCUMENT_FORMAT,
        version: 6,
        nodes: [
          wear('a', { mode: 1, density: 120, amount: 0.7, cracks: 9 }),
          wear('b', { mode: 2, angle: 45, width: 1.2 }),
          wear('c', { mode: 3, cracks: 20, length: 1.5 }),
        ],
        links: [],
        selected: 'a',
        resolution: 512,
        seed: 1,
      },
      getGenerator,
    );
    const [a, b, c] = doc.nodes;
    expect(a!.generator).toBe('brushed-metal');
    expect(a!.params).toMatchObject({ style: 1, density: 120, amount: 0.7 });
    expect(a!.params.cracks).toBeUndefined();
    expect(b!.generator).toBe('scratches');
    expect(b!.params).toMatchObject({ angle: 45, width: 1.2 });
    expect(c!.generator).toBe('cracked-glass');
    expect(c!.params).toMatchObject({ cracks: 20, length: 1.5 });
  });
});
