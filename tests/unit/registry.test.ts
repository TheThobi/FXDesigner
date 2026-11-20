import { describe, expect, it } from 'vitest';
import { POST_PARAMS } from '../../src/engine/post/schema';
import {
  buildGeneratorShader,
  glslUniformType,
  resolveIncludes,
} from '../../src/engine/shaderBuilder';
import { GENERATORS, getGenerator, DEFAULT_GENERATOR_ID } from '../../src/generators/registry';
import { isValidIdentifier, sanitizeValue, sanitizeValues } from '../../src/params/values';
import type { ParamDef } from '../../src/params/types';

function defaultInRange(def: ParamDef): boolean {
  try {
    expect(sanitizeValue(def, def.default)).toEqual(def.default);
    return true;
  } catch {
    return false;
  }
}

describe('generator registry', () => {
  it('has unique, URL-safe ids and the default exists', () => {
    const ids = GENERATORS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    expect(getGenerator(DEFAULT_GENERATOR_ID)).toBeDefined();
  });

  for (const g of GENERATORS) {
    describe(g.id, () => {
      it('declares valid, unique params with in-range defaults', () => {
        const keys = g.params.map((p) => p.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const p of g.params) {
          expect(isValidIdentifier(p.key), p.key).toBe(true);
          expect(defaultInRange(p), `${p.key} default out of range`).toBe(true);
        }
      });

      it('presets only reference existing params with valid values', () => {
        for (const preset of g.presets ?? []) {
          for (const [key, value] of Object.entries(preset.values)) {
            const def = g.params.find((p) => p.key === key);
            expect(def, `${preset.name}: unknown key ${key}`).toBeDefined();
            expect(sanitizeValue(def!, value), `${preset.name}.${key}`).toEqual(value);
          }
        }
      });

      it('defaultPost is valid', () => {
        const post = sanitizeValues(POST_PARAMS, g.defaultPost ?? {});
        for (const [key, value] of Object.entries(g.defaultPost ?? {})) {
          expect(post[key], key).toEqual(value);
        }
      });

      if (g.kind === 'shader') {
        it('uses every shader-visible param in its GLSL', () => {
          for (const p of g.params) {
            if (glslUniformType(p) === null) continue;
            expect(g.fragment, `u_${p.key} unused`).toMatch(new RegExp(`\\bu_${p.key}\\b`));
          }
        });

        it('defines generate() and assembles a complete shader', () => {
          expect(g.fragment).toMatch(/vec4\s+generate\s*\(\s*vec2\s+\w+\s*\)/);
          const src = buildGeneratorShader(g);
          expect(src.startsWith('#version 300 es')).toBe(true);
          expect(src).toContain('void main()');
          expect(src).not.toContain('#include');
        });
      }
    });
  }
});

describe('resolveIncludes', () => {
  it('inlines known chunks and rejects unknown ones', () => {
    expect(resolveIncludes('#include <common>')).toContain('#define PI');
    expect(() => resolveIncludes('#include <missing>')).toThrow();
  });
});
