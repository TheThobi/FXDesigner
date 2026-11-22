// Pen hatching (sketch shading textures): layers of short strokes along lattice directions
// (0°, 90°, 45°, 135°), broken into dashes of random length, offset, width and pressure.
// Seamless: rows and dashes use integer periods. Paper is white, ink black.
float strokes(vec2 uv, int dir, float salt) {
  float n = float(u_density);
  vec2 g = uv * n;
  float along;
  float across;
  if (dir == 0) {
    along = g.x;
    across = g.y;
  } else if (dir == 1) {
    along = g.y;
    across = g.x;
  } else if (dir == 2) {
    along = g.x + g.y;
    across = g.y - g.x;
  } else {
    along = g.x - g.y;
    across = g.x + g.y;
  }
  // Derivatives before the per-pixel early exit (undefined in divergent flow).
  float aa = fwidth(across) * 0.75;
  float row = floor(across);
  float rowKey = mod(row, n) + salt;
  float offset = (hash12(vec2(rowKey, 1.3)) - 0.5) * u_jitter;
  float fc = fract(across) - 0.5 - offset;
  float per = max(1.0, floor(n / u_dashLength + 0.5));
  float ad = along * per / n + floor(hash12(vec2(rowKey, 7.7)) * per);
  float id = mod(floor(ad), per);
  float fd = fract(ad);
  vec2 key = vec2(rowKey, id + salt * 3.1);
  if (hash12(key) > u_coverage) return 0.0;
  float taper = max(u_taper * 0.5, 1e-3);
  float ends = smoothstep(0.0, taper, fd) * smoothstep(1.0, 1.0 - taper, fd);
  float w = u_thickness * 0.5 * mix(0.6, 1.3, hash12(key + 4.2)) * mix(0.5, 1.0, ends);
  float line = 1.0 - smoothstep(w - aa, w + aa, abs(fc));
  return line * mix(1.0, 0.35 + 0.65 * hash12(key + 8.8), u_pressure) * mix(0.4, 1.0, ends);
}

vec4 generate(vec2 uv) {
  int d0 = u_direction;
  int d1 = d0 == 0 ? 1 : d0 == 1 ? 0 : d0 == 2 ? 3 : 2;
  int d2 = d0 < 2 ? 2 : 0;
  float ink = strokes(uv, d0, 0.0);
  if (u_layers >= 1) ink = max(ink, strokes(uv, d1, 11.0));
  if (u_layers >= 2) ink = max(ink, strokes(uv, d2, 23.0));
  return vec4(vec3(1.0 - ink), 1.0);
}
