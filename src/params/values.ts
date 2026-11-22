import { isHexColor, normalizeHex } from '../util/color';
import { clamp } from '../util/math';
import { sanitizeGradient, type GradientValue } from './gradient';
import type { FloatParam, IntParam, ParamDef, ParamValue, ParamValues, Vec2 } from './types';

/**
 * Range a numeric value may take when typed by hand or loaded: `def.limit`, else the slider
 * range widened above max (floats: up to 4× the range, ints: 2×) and below a negative min.
 * A min >= 0 stays a hard floor (counts, sizes and radii must not go negative).
 */
export function numericLimits(def: FloatParam | IntParam): readonly [number, number] {
  if (def.limit) return def.limit;
  const range = def.max - def.min;
  const extra = def.type === 'int' ? range : range * 3;
  const round = (v: number) => Number(v.toPrecision(6));
  return [def.min < 0 ? round(def.min - extra) : def.min, round(def.max + extra)];
}

export function defaultValues(defs: readonly ParamDef[]): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const def of defs) out[def.key] = def.default;
  return out;
}

/** Coerces `raw` into a valid value for `def`, falling back to `fallback` (default: def.default). */
export function sanitizeValue(
  def: ParamDef,
  raw: unknown,
  fallback: ParamValue = def.default,
): ParamValue {
  switch (def.type) {
    case 'float': {
      const n = typeof raw === 'number' ? raw : Number.NaN;
      const [lo, hi] = numericLimits(def);
      return Number.isFinite(n) ? clamp(n, lo, hi) : fallback;
    }
    case 'int': {
      const n = typeof raw === 'number' ? raw : Number.NaN;
      const [lo, hi] = numericLimits(def);
      return Number.isFinite(n) ? clamp(Math.round(n), lo, hi) : fallback;
    }
    case 'bool':
      return typeof raw === 'boolean' ? raw : fallback;
    case 'color':
      return isHexColor(raw) ? normalizeHex(raw) : fallback;
    case 'select':
      return typeof raw === 'number' && def.options.some((o) => o.value === raw) ? raw : fallback;
    case 'vec2': {
      if (!Array.isArray(raw) || raw.length !== 2) return fallback;
      const [x, y] = raw as unknown[];
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        return fallback;
      }
      return [clamp(x, def.min, def.max), clamp(y, def.min, def.max)];
    }
    case 'text':
      return typeof raw === 'string' ? raw.slice(0, def.maxLength ?? 256) : fallback;
    case 'gradient':
      return sanitizeGradient(raw) ?? fallback;
    case 'image':
      return typeof raw === 'string' &&
        (raw === '' || isImageDataUrl(raw) || isExternalImageUrl(raw))
        ? raw
        : fallback;
  }
}

/**
 * Builds a complete, valid value set for `defs` from untrusted input:
 * unknown keys are dropped, missing/invalid ones take `defaults[key]` or the schema default.
 */
export function sanitizeValues(
  defs: readonly ParamDef[],
  raw: unknown,
  defaults: ParamValues = {},
): Record<string, ParamValue> {
  const input = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const out: Record<string, ParamValue> = {};
  for (const def of defs) {
    const fallback =
      defaults[def.key] !== undefined ? sanitizeValue(def, defaults[def.key]) : def.default;
    out[def.key] = sanitizeValue(def, input[def.key], fallback);
  }
  return out;
}

// --- Typed accessors -------------------------------------------------------------------------

export function getNumber(values: ParamValues, key: string, fallback = 0): number {
  const v = values[key];
  return typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : fallback;
}

export function getBool(values: ParamValues, key: string, fallback = false): boolean {
  const v = values[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function getString(values: ParamValues, key: string, fallback = ''): string {
  const v = values[key];
  return typeof v === 'string' ? v : fallback;
}

export function getVec2(values: ParamValues, key: string, fallback: Vec2 = [0, 0]): Vec2 {
  const v = values[key];
  return Array.isArray(v) && v.length === 2 ? (v as Vec2) : fallback;
}

export function getGradient(values: ParamValues, key: string): GradientValue | null {
  return sanitizeGradient(values[key]);
}

export function isValidIdentifier(key: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(key);
}

/** Max length of an image data URL (~3 MB of base64). */
export const MAX_IMAGE_DATA_URL = 3_000_000;

export function isExternalImageUrl(value: string): boolean {
  if (value.length > 2048 || /[\s"<>\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Base64 PNG / JPEG / WebP data URL within the size limit. */
export function isImageDataUrl(value: string): boolean {
  return (
    value.length <= MAX_IMAGE_DATA_URL &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)
  );
}
