import { isGradientValue, type GradientValue } from '../params/gradient';
import type { GradientParam, ImageParam, ParamDef, ParamValue, ParamValues } from '../params/types';
import { hexToRgb } from '../util/color';
import type { UniformValue } from './gl/ShaderProgram';
import { uniformName } from './shaderBuilder';

/** Converts a parameter value to its uniform representation (null: not a plain uniform). */
export function toUniformValue(def: ParamDef, value: ParamValue | undefined): UniformValue | null {
  const v = value ?? def.default;
  switch (def.type) {
    case 'float':
    case 'int':
    case 'select':
      return typeof v === 'number' ? v : (def.default as number);
    case 'bool':
      return typeof v === 'boolean' ? v : def.default;
    case 'color':
      return hexToRgb(typeof v === 'string' ? v : def.default);
    case 'vec2':
      return Array.isArray(v) ? (v as readonly number[]) : def.default;
    case 'text':
    case 'gradient':
    case 'image':
      return null;
  }
}

/** Plain (non-texture) uniforms for a parameter set, keyed by uniform name. */
export function paramUniforms(
  defs: readonly ParamDef[],
  values: ParamValues,
): Record<string, UniformValue> {
  const out: Record<string, UniformValue> = {};
  for (const def of defs) {
    const u = toUniformValue(def, values[def.key]);
    if (u !== null) out[uniformName(def.key)] = u;
  }
  return out;
}

/** Gradient params that need a lookup texture, with their current (or default) value. */
export function gradientParams(
  defs: readonly ParamDef[],
  values: ParamValues,
): { def: GradientParam; value: GradientValue }[] {
  return defs
    .filter((d): d is GradientParam => d.type === 'gradient')
    .map((def) => {
      const v = values[def.key];
      return { def, value: isGradientValue(v) ? v : def.default };
    });
}

/** Image params with their data URL ('' = none). */
export function imageParams(
  defs: readonly ParamDef[],
  values: ParamValues,
): { def: ImageParam; value: string }[] {
  return defs
    .filter((d): d is ImageParam => d.type === 'image')
    .map((def) => {
      const v = values[def.key];
      return { def, value: typeof v === 'string' ? v : '' };
    });
}
