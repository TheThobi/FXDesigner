import { clamp01 } from './math';

export type RGB = readonly [number, number, number];

const HEX_RE = /^#?([0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

/** Parses `#rrggbb` into linear-agnostic [0, 1] components. Invalid input yields black. */
export function hexToRgb(hex: string): RGB {
  const match = HEX_RE.exec(hex.trim());
  if (!match?.[1]) return [0, 0, 0];
  const n = parseInt(match[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(rgb: RGB): string {
  return (
    '#' +
    rgb
      .map((c) =>
        Math.round(clamp01(c) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

export function normalizeHex(hex: string): string {
  return rgbToHex(hexToRgb(hex));
}
