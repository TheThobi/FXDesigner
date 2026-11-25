/**
 * Dense optical flow (pyramidal Lucas–Kanade): where each pixel of image A moved to in image B,
 * in pixels (x right, y down). Used to bake flipbook motion vectors for engines that blend
 * frames along them. Images are single-channel intensities; edges are clamped.
 */

interface Level {
  readonly w: number;
  readonly h: number;
  readonly data: Float32Array;
}

/** Window radius of the local least-squares fit (5×5 at radius 2). */
const RADIUS = 2;
/** Tikhonov term: flat areas (no gradient) get no motion instead of noise. */
const REGULARIZE = 1e-3;
const ITERATIONS = 3;

function downsample(l: Level): Level {
  const w = Math.max(1, l.w >> 1);
  const h = Math.max(1, l.h >> 1);
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.min(l.w - 1, x * 2);
      const y0 = Math.min(l.h - 1, y * 2);
      const x1 = Math.min(l.w - 1, x0 + 1);
      const y1 = Math.min(l.h - 1, y0 + 1);
      data[y * w + x] =
        (l.data[y0 * l.w + x0]! +
          l.data[y0 * l.w + x1]! +
          l.data[y1 * l.w + x0]! +
          l.data[y1 * l.w + x1]!) *
        0.25;
    }
  return { w, h, data };
}

function sample(l: Level, x: number, y: number): number {
  const cx = Math.min(l.w - 1, Math.max(0, x));
  const cy = Math.min(l.h - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(l.w - 1, x0 + 1);
  const y1 = Math.min(l.h - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const d = l.data;
  const a = d[y0 * l.w + x0]! + (d[y0 * l.w + x1]! - d[y0 * l.w + x0]!) * fx;
  const b = d[y1 * l.w + x0]! + (d[y1 * l.w + x1]! - d[y1 * l.w + x0]!) * fx;
  return a + (b - a) * fy;
}

/** Box sum over the (2r+1)² window, separable (clamped edges). */
function boxSum(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[y * w + Math.min(w - 1, Math.max(0, x + k))]!;
      tmp[y * w + x] = s;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x]!;
      out[y * w + x] = s;
    }
  return out;
}

export function opticalFlow(
  a: Float32Array,
  b: Float32Array,
  width: number,
  height: number,
): { u: Float32Array; v: Float32Array } {
  // Pyramids down to ~16 px.
  const pa: Level[] = [{ w: width, h: height, data: a }];
  const pb: Level[] = [{ w: width, h: height, data: b }];
  while (Math.min(pa.at(-1)!.w, pa.at(-1)!.h) >= 32 && pa.length < 6) {
    pa.push(downsample(pa.at(-1)!));
    pb.push(downsample(pb.at(-1)!));
  }
  let u = new Float32Array(pa.at(-1)!.w * pa.at(-1)!.h);
  let v = new Float32Array(u.length);
  for (let level = pa.length - 1; level >= 0; level--) {
    const la = pa[level]!;
    const lb = pb[level]!;
    const { w, h } = la;
    if (level < pa.length - 1) {
      // Upsample the coarser flow (×2 in size and magnitude).
      const prev = pa[level + 1]!;
      const nu = new Float32Array(w * h);
      const nv = new Float32Array(w * h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const px = Math.min(prev.w - 1, x >> 1);
          const py = Math.min(prev.h - 1, y >> 1);
          nu[y * w + x] = u[py * prev.w + px]! * 2;
          nv[y * w + x] = v[py * prev.w + px]! * 2;
        }
      u = nu;
      v = nv;
    }
    // Spatial gradients of A (central differences).
    const ix = new Float32Array(w * h);
    const iy = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = la.data;
        ix[y * w + x] = (d[y * w + Math.min(w - 1, x + 1)]! - d[y * w + Math.max(0, x - 1)]!) * 0.5;
        iy[y * w + x] = (d[Math.min(h - 1, y + 1) * w + x]! - d[Math.max(0, y - 1) * w + x]!) * 0.5;
      }
    const sxx = boxSum(
      ix.map((g) => g * g),
      w,
      h,
      RADIUS,
    );
    const sxy = boxSum(
      ix.map((g, i) => g * iy[i]!),
      w,
      h,
      RADIUS,
    );
    const syy = boxSum(
      iy.map((g) => g * g),
      w,
      h,
      RADIUS,
    );
    for (let it = 0; it < ITERATIONS; it++) {
      // Temporal difference with B warped by the current flow.
      const xt = new Float32Array(w * h);
      const yt = new Float32Array(w * h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const diff = sample(lb, x + u[i]!, y + v[i]!) - la.data[i]!;
          xt[i] = ix[i]! * diff;
          yt[i] = iy[i]! * diff;
        }
      const sxt = boxSum(xt, w, h, RADIUS);
      const syt = boxSum(yt, w, h, RADIUS);
      for (let i = 0; i < w * h; i++) {
        const a11 = sxx[i]! + REGULARIZE;
        const a12 = sxy[i]!;
        const a22 = syy[i]! + REGULARIZE;
        const det = a11 * a22 - a12 * a12;
        if (det < 1e-9) continue;
        const du = -(a22 * sxt[i]! - a12 * syt[i]!) / det;
        const dv = -(a11 * syt[i]! - a12 * sxt[i]!) / det;
        // Clamp each update: LK is only valid for small steps.
        u[i] = u[i]! + Math.max(-2, Math.min(2, du));
        v[i] = v[i]! + Math.max(-2, Math.min(2, dv));
      }
    }
  }
  return { u, v };
}

/** Intensity of a straight-RGBA8 frame for the flow: luminance weighted by alpha, plus alpha. */
export function flowIntensity(rgba: ArrayLike<number>, pixels: number): Float32Array {
  const out = new Float32Array(pixels);
  for (let p = 0, i = 0; p < pixels; p++, i += 4) {
    const a = rgba[i + 3]! / 255;
    const l = (0.2126 * rgba[i]! + 0.7152 * rgba[i + 1]! + 0.0722 * rgba[i + 2]!) / 255;
    out[p] = l * a * 0.7 + a * 0.3;
  }
  return out;
}
