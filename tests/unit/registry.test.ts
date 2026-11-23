import { describe, expect, it } from 'vitest';
import { upgradeLegacyPost } from '../../src/engine/post/legacy';
import { DEFAULT_RAMP, POST_PARAMS } from '../../src/engine/post/schema';
import { GRADIENT_PRESETS, GRADIENTS } from '../../src/params/gradientPresets';
import { sanitizeGradient } from '../../src/params/gradient';
import {
  buildGeneratorShader,
  glslUniformType,
  RESERVED_UNIFORMS,
  resolveIncludes,
} from '../../src/engine/shaderBuilder';
import {
  DEFAULT_GENERATOR_ID,
  GENERATORS,
  generatorsByFamily,
  getGenerator,
} from '../../src/generators/registry';
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

      it('export overrides and split handle reference valid params', () => {
        for (const [key, value] of Object.entries(g.exportOverrides ?? {})) {
          const def = g.params.find((p) => p.key === key);
          expect(def, `exportOverrides.${key}`).toBeDefined();
          expect(sanitizeValue(def!, value)).toEqual(value);
        }
        if (g.split) {
          const def = g.params.find((p) => p.key === g.split!.key);
          expect(def?.type, 'split param').toBe('float');
        }
      });

      if (g.kind === 'shader') {
        it('uses every shader-visible param in its GLSL', () => {
          for (const p of g.params) {
            if (glslUniformType(p) === null) continue;
            const all = [g.fragment, ...(g.passes ?? []).map((pass) => pass.fragment)].join('\n');
            expect(all, `u_${p.key} unused`).toMatch(new RegExp(`\\bu_${p.key}\\b`));
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

describe('generator browser', () => {
  it('lists every addable generator exactly once across families', () => {
    const listed = generatorsByFamily().flatMap((f) =>
      f.sections.flatMap((s) => s.generators.map((g) => g.id)),
    );
    expect(listed.sort()).toEqual(
      GENERATORS.filter((g) => !g.role && g.id !== 'op-levels')
        .map((g) => g.id)
        .sort(),
    );
  });
});

describe('seamless loop', () => {
  it('drives u_time from the engine clock, not a uniform', () => {
    const g = GENERATORS.find((d) => d.kind === 'shader' && d.animated);
    if (g?.kind !== 'shader') throw new Error('no animated shader generator');
    const src = buildGeneratorShader(g);
    expect(src).toMatch(/^float u_time;$/m);
    expect(src).not.toMatch(/uniform float u_time;/);
    expect(src).toContain('uniform vec3 u_loop;');
  });
});

describe('gradient presets', () => {
  it('default ramp is plain black to white', () => {
    expect(DEFAULT_RAMP).toEqual(GRADIENTS.linear);
    expect(GRADIENT_PRESETS[0]?.value).toEqual(GRADIENTS.linear);
  });

  it('have unique names that do not reference generators', () => {
    const names = GRADIENT_PRESETS.map((p) => p.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    const words = new Set(
      GENERATORS.flatMap((g) => g.name.toLowerCase().split(/[^a-z]+/)).filter((w) => w.length > 3),
    );
    for (const name of names) {
      for (const w of name.split(/[^a-z]+/))
        expect(words.has(w), `${name} ~ generator "${w}"`).toBe(false);
    }
  });
});

describe('resolveIncludes', () => {
  it('inlines known chunks and rejects unknown ones', () => {
    expect(resolveIncludes('#include <common>')).toContain('#define PI');
    expect(() => resolveIncludes('#include <missing>')).toThrow();
  });
});

describe('reserved uniform names', () => {
  it('no param key maps onto an engine-provided uniform', () => {
    const reserved = new Set<string>(RESERVED_UNIFORMS);
    for (const g of GENERATORS) {
      for (const p of g.params) expect(reserved.has(`u_${p.key}`), `${g.id}.${p.key}`).toBe(false);
    }
  });
});

describe('presets with post overrides', () => {
  it('set the ramp with `ramp`, never a per-generator gradient', () => {
    for (const g of GENERATORS) {
      for (const preset of g.presets ?? []) {
        expect('gradient' in (preset.post ?? {}), `${g.id}/${preset.name}`).toBe(false);
        if (preset.ramp) expect(sanitizeGradient(preset.ramp)).toEqual(preset.ramp);
      }
    }
  });

  it('only reference valid post params', () => {
    for (const g of GENERATORS) {
      for (const preset of g.presets ?? []) {
        const upgraded = upgradeLegacyPost(preset.post ?? {});
        const post = sanitizeValues(POST_PARAMS, upgraded);
        for (const [key, value] of Object.entries(upgraded)) {
          expect(post[key], `${g.id}/${preset.name}: post.${key}`).toEqual(value);
        }
      }
    }
  });
});
