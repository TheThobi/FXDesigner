// ---- noise: seeded hashes, periodic gradient noise, fBm, Voronoi -----------------------------
// Requires `uniform float u_seed;` to be declared before inclusion.
//
// Periodicity: every lattice function takes a `period` (in lattice cells). A component <= 0
// disables wrapping on that axis. With integer periods the result tiles seamlessly.

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + u_seed * 0.1234);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973) + u_seed * 0.1234);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec2 wrapCell(vec2 cell, vec2 period) {
  return vec2(period.x > 0.0 ? mod(cell.x, period.x) : cell.x,
              period.y > 0.0 ? mod(cell.y, period.y) : cell.y);
}

// Unit gradient for a lattice cell. `flow` rotates gradients (half clockwise, half
// counter-clockwise) which animates the noise without a third dimension.
vec2 latticeGradient(vec2 cell, vec2 period, float flow) {
  float h = hash12(wrapCell(cell, period));
  float dir = fract(h * 7.31) > 0.5 ? 1.0 : -1.0;
  float a = h * TAU + flow * dir;
  return vec2(cos(a), sin(a));
}

// Gradient (Perlin-style) noise, approximately in [-1, 1].
float gradientNoise(vec2 p, vec2 period, float flow) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(latticeGradient(i, period, flow), f);
  float b = dot(latticeGradient(i + vec2(1.0, 0.0), period, flow), f - vec2(1.0, 0.0));
  float c = dot(latticeGradient(i + vec2(0.0, 1.0), period, flow), f - vec2(0.0, 1.0));
  float d = dot(latticeGradient(i + vec2(1.0, 1.0), period, flow), f - vec2(1.0, 1.0));
  return 1.41421356 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Value noise in [0, 1].
float valueNoise(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(wrapCell(i, period));
  float b = hash12(wrapCell(i + vec2(1.0, 0.0), period));
  float c = hash12(wrapCell(i + vec2(0.0, 1.0), period));
  float d = hash12(wrapCell(i + vec2(1.0, 1.0), period));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Simplex noise (2D), approximately in [-1, 1]. Not periodic: ignores tiling.
float simplexNoise(vec2 p, float flow) {
  const float F2 = 0.366025404; // (sqrt(3) - 1) / 2
  const float G2 = 0.211324865; // (3 - sqrt(3)) / 6
  vec2 i = floor(p + (p.x + p.y) * F2);
  vec2 x0 = p - i + (i.x + i.y) * G2;
  vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 x1 = x0 - i1 + G2;
  vec2 x2 = x0 - 1.0 + 2.0 * G2;
  vec3 h = max(0.5 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
  h = h * h * h * h;
  vec3 n = h * vec3(dot(x0, latticeGradient(i, vec2(0.0), flow)),
                    dot(x1, latticeGradient(i + i1, vec2(0.0), flow)),
                    dot(x2, latticeGradient(i + 1.0, vec2(0.0), flow)));
  return 70.0 * (n.x + n.y + n.z);
}

#define METRIC_EUCLIDEAN 0
#define METRIC_MANHATTAN 1
#define METRIC_CHEBYSHEV 2

float metricLength(vec2 v, int metric) {
  if (metric == METRIC_MANHATTAN) return (abs(v.x) + abs(v.y)) * 0.7071;
  if (metric == METRIC_CHEBYSHEV) return max(abs(v.x), abs(v.y));
  return length(v);
}

// Feature point of a Voronoi cell, in cell-local coordinates. Points rest inside the central
// 60% of their cell and, when animated, orbit around that rest position: neighbouring points
// therefore always stay >= 0.2 cells apart (no slivers, no points merging).
vec2 cellPoint(vec2 cell, float jitter, float flow) {
  vec2 rest = 0.5 + (hash22(cell) - 0.5) * 0.6 * jitter;
  float a = flow + TAU * hash12(cell + 5.1);
  return rest + vec2(cos(a), sin(a)) * 0.1 * jitter;
}

// Cellular noise. Returns vec3(F1, F2, cell hash). Distances are in cell units.
vec3 voronoi(vec2 p, vec2 period, float jitter, float flow, int metric) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  float id = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 cell = wrapCell(i + g, period);
      float d = metricLength(g + cellPoint(cell, jitter, flow) - f, metric);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash12(cell + 3.7);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return vec3(f1, f2, id);
}

// Exact Voronoi border distance (after Inigo Quilez): unlike F2 - F1, it measures the true
// distance to the cell edge, so lines drawn from it have a uniform width everywhere.
// xy = vector from p to the nearest feature point, z = border distance, w = cell hash.
vec4 voronoiNearest(vec2 p, vec2 period, float jitter, float flow) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 mg = vec2(0.0);
  vec2 mr = vec2(0.0);
  vec2 mcell = vec2(0.0);
  float md = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 cell = wrapCell(i + g, period);
      vec2 r = g + cellPoint(cell, jitter, flow) - f;
      float d = dot(r, r);
      if (d < md) {
        md = d;
        mr = r;
        mg = g;
        mcell = cell;
      }
    }
  }
  float border = 8.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 g = mg + vec2(float(x), float(y));
      vec2 r = g + cellPoint(wrapCell(i + g, period), jitter, flow) - f;
      vec2 diff = r - mr;
      if (dot(diff, diff) > 1e-6) border = min(border, dot(0.5 * (mr + r), normalize(diff)));
    }
  }
  return vec4(mr, border, hash12(mcell + 3.7));
}

vec4 voronoiNearest(vec2 p, vec2 period, float jitter) {
  return voronoiNearest(p, period, jitter, 0.0);
}

#define BASIS_PERLIN 0
#define BASIS_VALUE 1
#define BASIS_SIMPLEX 2
#define BASIS_WORLEY 3
#define BASIS_PERLIN_WORLEY 4

// One octave of the chosen basis, approximately in [-1, 1].
float basisNoise(vec2 p, vec2 period, float flow, int basis) {
  if (basis == BASIS_VALUE) return valueNoise(p + flow * 0.15, period) * 2.0 - 1.0;
  if (basis == BASIS_SIMPLEX) return simplexNoise(p, flow);
  if (basis == BASIS_WORLEY) return 1.0 - 2.4 * voronoi(p, period, 1.0, flow, METRIC_EUCLIDEAN).x;
  if (basis == BASIS_PERLIN_WORLEY) {
    float w = 1.0 - 2.4 * voronoi(p, period, 1.0, flow, METRIC_EUCLIDEAN).x;
    return 0.5 * (gradientNoise(p, period, flow) + w);
  }
  return gradientNoise(p, period, flow);
}

#define FBM_STANDARD 0
#define FBM_TURBULENCE 1
#define FBM_RIDGED 2

// Fractal sum of a noise basis, roughly in [-1, 1]. For seamless tiling keep `lacunarity`
// an integer so the period scales to whole cells at each octave.
float fbmBasis(vec2 p, int octaves, float lacunarity, float gain, vec2 period, float flow, int mode, int basis) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= octaves) break;
    float n = basisNoise(p, period, flow * (1.0 + 0.5 * float(i)), basis);
    if (mode == FBM_TURBULENCE) {
      n = abs(n) * 2.0 - 1.0;
    } else if (mode == FBM_RIDGED) {
      n = 1.0 - abs(n);
      n = n * n * 2.0 - 1.0;
    }
    sum += n * amp;
    norm += amp;
    // Offset each octave so lattice origins don't align (shifts keep periodicity intact).
    p = p * lacunarity + vec2(17.17, 3.71) * float(i + 1);
    period *= lacunarity;
    amp *= gain;
  }
  return sum / max(norm, 1e-5);
}

// Fractal sum of gradient (Perlin-style) noise.
float fbm(vec2 p, int octaves, float lacunarity, float gain, vec2 period, float flow, int mode) {
  return fbmBasis(p, octaves, lacunarity, gain, period, flow, mode, BASIS_PERLIN);
}

// Simple standard fBm with default lacunarity/gain, no tiling.
float fbm(vec2 p, int octaves) {
  return fbm(p, octaves, 2.0, 0.5, vec2(0.0), 0.0, FBM_STANDARD);
}

// Noise that wraps around the angle of `p` (no seam at +/-PI). `freq` should be an integer.
// `y` is a free second coordinate (e.g. radius or time).
float polarNoise(vec2 p, float freq, float y, int octaves) {
  float a = atan(p.y, p.x) / TAU + 0.5;
  return fbm(vec2(a * freq, y), octaves, 2.0, 0.5, vec2(freq, 0.0), 0.0, FBM_STANDARD);
}

// Curl of a periodic fBm potential: a divergence-free flow direction field.
vec2 curlNoise(vec2 p, vec2 period, float flow, int octaves) {
  float e = 0.01;
  float px1 = fbm(p + vec2(e, 0.0), octaves, 2.0, 0.5, period, flow, FBM_STANDARD);
  float px0 = fbm(p - vec2(e, 0.0), octaves, 2.0, 0.5, period, flow, FBM_STANDARD);
  float py1 = fbm(p + vec2(0.0, e), octaves, 2.0, 0.5, period, flow, FBM_STANDARD);
  float py0 = fbm(p - vec2(0.0, e), octaves, 2.0, 0.5, period, flow, FBM_STANDARD);
  return vec2(py1 - py0, -(px1 - px0)) / (2.0 * e);
}

// Toroidal (wrapped) difference a - b for points in [0, 1)^2.
vec2 wrapDelta(vec2 a, vec2 b) {
  vec2 d = a - b;
  return d - floor(d + 0.5);
}
