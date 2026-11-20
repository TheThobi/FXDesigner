import { describe, expect, it } from 'vitest';
import {
  applyDocument,
  decodeDocumentFromUrl,
  documentFromState,
  DocumentError,
  DOCUMENT_FORMAT,
  encodeDocumentForUrl,
  parseDocument,
} from '../../src/app/document';
import type { EditorState } from '../../src/app/state';
import { getGenerator } from '../../src/generators/registry';

const state: EditorState = {
  generatorId: 'fractal-noise',
  params: {
    'fractal-noise': {
      noiseType: 2,
      scale: 7,
      octaves: 3,
      lacunarity: 2,
      gain: 0.5,
      tileable: true,
      speed: 0,
    },
  },
  post: {},
  resolution: 1024,
  seed: 42,
};

describe('document round trip', () => {
  it('survives serialize -> URL encode -> decode -> parse', () => {
    const doc = documentFromState(state, getGenerator);
    const parsed = parseDocument(decodeDocumentFromUrl(encodeDocumentForUrl(doc)), getGenerator);
    expect(parsed).toEqual(doc);
    expect(parsed.params.scale).toBe(7);
    expect(parsed.post.colorMode).toBeDefined();
  });

  it('applies onto existing state without losing other generators', () => {
    const doc = documentFromState(state, getGenerator);
    const other: EditorState = { ...state, generatorId: 'glow', params: { glow: { radius: 0.3 } } };
    const merged = applyDocument(other, doc);
    expect(merged.generatorId).toBe('fractal-noise');
    expect(merged.params.glow).toEqual({ radius: 0.3 });
  });

  it('encodes unicode text safely', () => {
    const s: EditorState = {
      ...state,
      generatorId: 'reaction-diffusion',
      params: { 'reaction-diffusion': { seedText: 'Ωé✓' } },
    };
    const doc = documentFromState(s, getGenerator);
    const back = parseDocument(decodeDocumentFromUrl(encodeDocumentForUrl(doc)), getGenerator);
    expect(back.params.seedText).toBe('Ωé✓');
  });
});

describe('parseDocument validation', () => {
  const base = {
    format: DOCUMENT_FORMAT,
    version: 1,
    generator: 'glow',
    params: {},
    post: {},
    resolution: 512,
    seed: 3,
  };

  it('rejects foreign or future documents', () => {
    expect(() => parseDocument({ ...base, format: 'other' }, getGenerator)).toThrow(DocumentError);
    expect(() => parseDocument({ ...base, version: 99 }, getGenerator)).toThrow(DocumentError);
    expect(() => parseDocument({ ...base, generator: 'nope' }, getGenerator)).toThrow(
      DocumentError,
    );
    expect(() => parseDocument('x', getGenerator)).toThrow(DocumentError);
  });

  it('sanitizes values, resolution and seed', () => {
    const doc = parseDocument(
      { ...base, params: { radius: 99 }, resolution: 700, seed: -5 },
      getGenerator,
    );
    expect(doc.params.radius).toBe(1.5);
    expect(doc.resolution).toBe(512);
    expect(doc.seed).toBe(0);
  });

  it('fills post defaults from the generator', () => {
    const doc = parseDocument({ ...base, generator: 'flame' }, getGenerator);
    expect(doc.post.alphaMode).toBe(1);
  });

  it('rejects corrupted share links', () => {
    expect(() => decodeDocumentFromUrl('%%%')).toThrow(DocumentError);
  });
});
