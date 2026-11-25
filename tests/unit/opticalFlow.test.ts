import { describe, expect, it } from 'vitest';
import { opticalFlow } from '../../src/util/opticalFlow';

/** Smooth blobs (texture with gradients everywhere around the center), shifted by (dx, dy). */
function image(w: number, h: number, dx: number, dy: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const px = x - dx;
      const py = y - dy;
      out[y * w + x] =
        Math.exp(-((px - 40) ** 2 + (py - 30) ** 2) / 120) +
        0.7 * Math.exp(-((px - 22) ** 2 + (py - 44) ** 2) / 60) +
        0.5 * Math.exp(-((px - 46) ** 2 + (py - 48) ** 2) / 40);
    }
  return out;
}

describe('opticalFlow', () => {
  it.each([
    [2, -1],
    [5, 3],
  ])('recovers a translation of (%d, %d) px on textured areas', (dx, dy) => {
    const w = 64;
    const h = 64;
    const { u, v } = opticalFlow(image(w, h, 0, 0), image(w, h, dx, dy), w, h);
    // Average over where the image has structure (around the blobs).
    let su = 0;
    let sv = 0;
    let n = 0;
    for (const [x, y] of [
      [36, 30],
      [44, 30],
      [40, 26],
      [22, 40],
      [26, 44],
    ] as const) {
      su += u[y * w + x]!;
      sv += v[y * w + x]!;
      n++;
    }
    expect(su / n).toBeCloseTo(dx, 0);
    expect(sv / n).toBeCloseTo(dy, 0);
  });

  it('finds no motion between identical frames', () => {
    const img = image(32, 32, 0, 0);
    const { u, v } = opticalFlow(img, img, 32, 32);
    expect(Math.max(...u.map(Math.abs), ...v.map(Math.abs))).toBeLessThan(1e-3);
  });
});
