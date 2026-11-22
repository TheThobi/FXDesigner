// Geometric tile patterns (seamless: integer cell counts):
//   0 chevrons · 1 seigaiha scales · 2 half-square triangles · 3 shape grid
//   4 halftone dots · 5 labyrinth · 6 basket weave · 7 concentric squares
float shapeSdf(vec2 p, float r) {
  if (u_shape == 0) return length(p) - r;
  if (u_shape == 1) return sdStar(p, r * 1.15, 3, 2.0);
  if (u_shape == 2) return sdStar(p, r * 1.2, 5, 3.2);
  if (u_shape == 3) {
    vec2 d = abs(p) - vec2(r * 0.75);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r * 0.25;
  }
  if (u_shape == 4) {
    vec2 q = abs(p);
    return (q.x + q.y - r * 1.2) * 0.7071;
  }
  vec2 q = abs(p);
  float w = r * 0.32;
  return min(max(q.x - r, q.y - w), max(q.x - w, q.y - r));
}

// Band of relative width `w` around the centre of each unit period of x.
float bandAA(float x, float w, float aa) {
  float d = abs(fract(x) - 0.5);
  return 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, d);
}

float band(float x, float w) {
  return bandAA(x, w, fwidth(x) * 0.75);
}

float seigaiha(vec2 g, float t) {
  // Fans of radius 0.5 on rows every 0.25 cell, odd rows shifted by half a cell. A fan lower
  // in the image overlaps the ones above it, so the lowest fan containing the point wins.
  // Derivatives are taken before the per-pixel early exit (undefined in divergent flow).
  float aa = fwidth(g.x) * 2.0 * float(u_rings) * 0.75;
  float r0 = floor(g.y / 0.25);
  for (int k = -2; k <= 2; k++) {
    float row = r0 + float(k);
    float shift = mod(row, 2.0) * 0.5;
    vec2 c = vec2(floor(g.x - shift + 0.5) + shift, row * 0.25);
    float d = length(g - c) / 0.5;
    if (d < 1.0) return bandAA(d * float(u_rings) - t, u_thickness, aa);
  }
  return 0.0;
}

float labyrinth(vec2 g, float n) {
  vec2 i = floor(g);
  vec2 f = fract(g);
  float w = u_thickness * 0.25;
  float d = 8.0;
  if (hash12(mod(i, n)) < 0.5) d = min(d, f.x);
  if (hash12(mod(i + vec2(1.0, 0.0), n)) < 0.5) d = min(d, 1.0 - f.x);
  if (hash12(mod(i, n) + 17.3) < 0.5) d = min(d, f.y);
  if (hash12(mod(i + vec2(0.0, 1.0), n) + 17.3) < 0.5) d = min(d, 1.0 - f.y);
  float aa = fwidth(g.x) * 0.75;
  return 1.0 - smoothstep(w - aa, w + aa, d);
}

float weave(vec2 g) {
  vec2 i = floor(g);
  vec2 f = fract(g);
  bool horizontal = mod(i.x + i.y, 2.0) < 0.5;
  float across = horizontal ? f.y : f.x;
  float s = fract(across * 2.0);
  float tube = pow(sin(PI * s), 0.6);
  float gap = smoothstep(0.0, 0.06, s) * smoothstep(1.0, 0.94, s);
  float along = horizontal ? f.x : f.y;
  return tube * gap * mix(0.75, 1.0, smoothstep(0.0, 0.2, min(along, 1.0 - along)));
}

vec4 generate(vec2 uv) {
  float n = float(u_cells);
  float t = u_time * u_speed;
  vec2 g = uv * n;
  // One pixel in cell units. SDF anti-aliasing uses it rather than fwidth(d): fwidth spikes
  // where the SDF gradient is discontinuous (e.g. the diagonals of a rounded square).
  float px = n / u_resolution.x;
  float v = 0.0;
  if (u_mode == 0) {
    // Zigzag stripes: one zig per cell horizontally, `cells` stripes vertically.
    float zig = abs(fract(g.x) - 0.5) * 2.0 * u_amplitude;
    v = band(g.y + zig - t, u_thickness);
  } else if (u_mode == 1) {
    v = seigaiha(g, t);
  } else if (u_mode == 2) {
    vec2 id = mod(floor(g), n);
    vec2 f = fract(g);
    float h = hash12(id + 0.37);
    float orient = h < u_randomness ? floor(hash12(id + 9.1) * 4.0) : mod(id.x + 2.0 * id.y, 4.0);
    if (orient == 1.0 || orient == 3.0) f.x = 1.0 - f.x;
    if (orient >= 2.0) f.y = 1.0 - f.y;
    float d = (f.x + f.y - 1.0) * 0.7071;
    v = fillMask(d, px * 0.7071);
  } else if (u_mode == 3 || u_mode == 4) {
    if (u_offsetRows && mod(floor(g.y), 2.0) > 0.5) g.x += 0.5;
    vec2 id = mod(floor(g), n);
    vec2 p = rotate2d(fract(g) - 0.5, radians(u_rotation) + t);
    float r = u_size * 0.5 * mix(1.0, 0.4 + 0.6 * hash12(id + 2.3), u_randomness);
    if (u_mode == 4) {
      // Halftone: dot size follows a seamless triangle wave across the image.
      float ramp = 1.0 - abs(fract(uv.y + t * 0.1) * 2.0 - 1.0);
      r = u_size * 0.5 * mix(0.08, 1.0, pow(ramp, u_amplitude));
      p = fract(g) - 0.5;
    }
    float d = u_mode == 4 ? length(p) - r : shapeSdf(p, r);
    v = u_outline ? strokeMask(d, u_thickness * 0.15, px) : fillMask(d, px);
  } else if (u_mode == 5) {
    v = labyrinth(g, n);
  } else if (u_mode == 6) {
    v = weave(g);
  } else {
    vec2 p = rotate2d(fract(g) - 0.5, radians(u_rotation));
    float d = max(abs(p.x), abs(p.y)) * 2.0;
    v = band(d * float(u_rings) - t, u_thickness);
  }
  return vec4(vec3(v), 1.0);
}
