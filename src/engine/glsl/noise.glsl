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

#define FBM_STANDARD 0
#define FBM_TURBULENCE 1
#define FBM_RIDGED 2

// Fractal sum of gradient noise, roughly in [-1, 1]. For seamless tiling keep `lacunarity`
// an integer so the period scales to whole cells at each octave.
float fbm(vec2 p, int octaves, float lacunarity, float gain, vec2 period, float flow, int mode) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= octaves) break;
    float n = gradientNoise(p, period, flow * (1.0 + 0.5 * float(i)));
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

#define METRIC_EUCLIDEAN 0
#define METRIC_MANHATTAN 1
#define METRIC_CHEBYSHEV 2

float metricLength(vec2 v, int metric) {
  if (metric == METRIC_MANHATTAN) return (abs(v.x) + abs(v.y)) * 0.7071;
  if (metric == METRIC_CHEBYSHEV) return max(abs(v.x), abs(v.y));
  return length(v);
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
      vec2 h = hash22(cell);
      vec2 o = 0.5 + 0.5 * sin(flow + TAU * h);
      o = mix(vec2(0.5), o, jitter);
      float d = metricLength(g + o - f, metric);
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
