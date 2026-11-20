import { hexToRgb, isHexColor, normalizeHex } from '../util/color';
import { clamp01, lerp } from '../util/math';

export interface GradientStop {
  /** Position in [0, 1]. */
  readonly pos: number;
  /** `#rrggbb` */
  readonly color: string;
  /** Opacity in [0, 1]. */
  readonly alpha: number;
}

export interface GradientValue {
  readonly stops: readonly GradientStop[];
}

export type RGBA = [number, number, number, number];

export const GRADIENT_BAKE_WIDTH = 256;
export const MAX_GRADIENT_STOPS = 16;

export function isGradientValue(value: unknown): value is GradientValue {
  return (
    typeof value === 'object' && value !== null && Array.isArray((value as GradientValue).stops)
  );
}

/** Validates arbitrary input into a gradient; returns null when unusable. Stop order is preserved. */
export function sanitizeGradient(raw: unknown): GradientValue | null {
  if (!isGradientValue(raw)) return null;
  const stops: GradientStop[] = [];
  for (const s of raw.stops.slice(0, MAX_GRADIENT_STOPS)) {
    if (typeof s !== 'object' || s === null) continue;
    const pos = Number((s as GradientStop).pos);
    const color = (s as GradientStop).color;
    const alphaRaw = (s as GradientStop).alpha;
    if (!Number.isFinite(pos) || !isHexColor(color)) continue;
    const alpha = typeof alphaRaw === 'number' && Number.isFinite(alphaRaw) ? clamp01(alphaRaw) : 1;
    stops.push({ pos: clamp01(pos), color: normalizeHex(color), alpha });
  }
  return stops.length > 0 ? { stops } : null;
}

export function sortedStops(gradient: GradientValue): GradientStop[] {
  return [...gradient.stops].sort((a, b) => a.pos - b.pos);
}

function sampleSorted(stops: readonly GradientStop[], t: number): RGBA {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return [0, 0, 0, 1];
  if (t <= first.pos) return [...hexToRgb(first.color), first.alpha];
  if (t >= last.pos) return [...hexToRgb(last.color), last.alpha];
  for (let i = 1; i < stops.length; i++) {
    const b = stops[i]!;
    if (t <= b.pos) {
      const a = stops[i - 1]!;
      const span = b.pos - a.pos;
      const k = span > 0 ? (t - a.pos) / span : 0;
      const ca = hexToRgb(a.color);
      const cb = hexToRgb(b.color);
      return [
        lerp(ca[0], cb[0], k),
        lerp(ca[1], cb[1], k),
        lerp(ca[2], cb[2], k),
        lerp(a.alpha, b.alpha, k),
      ];
    }
  }
  return [...hexToRgb(last.color), last.alpha];
}

/** Samples the gradient at t in [0, 1]; returns RGBA in [0, 1]. */
export function sampleGradient(gradient: GradientValue, t: number): RGBA {
  return sampleSorted(sortedStops(gradient), clamp01(t));
}

/** Rasterizes the gradient into a width x 1 RGBA8 strip (texture upload). */
export function bakeGradient(gradient: GradientValue, width = GRADIENT_BAKE_WIDTH): Uint8Array {
  const stops = sortedStops(gradient);
  const out = new Uint8Array(width * 4);
  for (let x = 0; x < width; x++) {
    const c = sampleSorted(stops, width === 1 ? 0 : x / (width - 1));
    for (let i = 0; i < 4; i++) out[x * 4 + i] = Math.round(clamp01(c[i]!) * 255);
  }
  return out;
}

export function gradientToCss(gradient: GradientValue, direction = 'to right'): string {
  const parts = sortedStops(gradient).map((s) => {
    const [r, g, b] = hexToRgb(s.color).map((c) => Math.round(c * 255));
    return `rgba(${r}, ${g}, ${b}, ${s.alpha}) ${(s.pos * 100).toFixed(1)}%`;
  });
  if (parts.length === 1) parts.push(parts[0]!);
  return `linear-gradient(${direction}, ${parts.join(', ')})`;
}

/** Stable cache key (identical gradients produce identical keys). */
export function gradientKey(gradient: GradientValue): string {
  return sortedStops(gradient)
    .map((s) => `${s.pos.toFixed(4)}${s.color}${s.alpha.toFixed(3)}`)
    .join('|');
}

export function reverseGradient(gradient: GradientValue): GradientValue {
  return { stops: gradient.stops.map((s) => ({ ...s, pos: 1 - s.pos })) };
}

/** Shorthand: gradient(['#000', 0], ['#fff', 1]) or with alpha: ['#fff', 1, 0.5]. */
export function gradient(...stops: [color: string, pos: number, alpha?: number][]): GradientValue {
  return { stops: stops.map(([color, pos, alpha = 1]) => ({ color, pos, alpha })) };
}
