// Procedural rune glyphs: each glyph joins random points of a 3x3 lattice with strokes.
// Laid out on a seamless grid or around a ring (magic circles).
float glyph(vec2 f, vec2 id) {
  // f in [0,1]^2 inside the glyph cell.
  float d = 8.0;
  for (int k = 0; k < 7; k++) {
    if (k >= u_strokes) break;
    vec2 h = floor(hash22(id + float(k) * 7.31) * 3.0);
    vec2 h2 = floor(hash22(id + float(k) * 3.17 + 11.0) * 3.0);
    if (h == h2) h2 = vec2(2.0) - h;
    vec2 a = 0.2 + h * 0.3;
    vec2 b = 0.2 + h2 * 0.3;
    d = min(d, sdSegment(f, a, b));
  }
  // Optional dot accent.
  if (hash12(id + 5.5) > 0.6) d = min(d, length(f - (0.2 + floor(hash22(id + 9.1) * 3.0) * 0.3)) - 0.03);
  return d;
}

vec4 generate(vec2 uv) {
  float t = u_time * u_speed;
  vec2 f;
  vec2 id;
  float cellPx;
  if (u_layout == 0) {
    float n = float(u_cells);
    vec2 g = uv * n;
    id = mod(floor(g), n);
    f = fract(g);
    cellPx = u_resolution.x / n;
  } else {
    vec2 p = centered(uv);
    float count = float(u_cells) * 3.0;
    float a = atan(p.y, p.x) / TAU + 0.5;
    float r = length(p);
    float band = 1.6 * PI * u_ringRadius / count; // glyph height ~ width along the ring
    f = vec2(fract(a * count), (r - u_ringRadius) / band + 0.5);
    id = vec2(mod(floor(a * count), count), 0.0);
    if (f.y < 0.0 || f.y > 1.0) {
      float ringD = min(abs(r - u_ringRadius - band * 0.6), abs(r - u_ringRadius + band * 0.6));
      float aa = 2.0 / u_resolution.x;
      float line = 1.0 - smoothstep(u_lineWidth * band * 0.15, u_lineWidth * band * 0.15 + aa, ringD);
      return vec4(vec3(line), 1.0);
    }
    cellPx = band * u_resolution.x * 0.5;
  }
  float d = glyph(f, id);
  float w = u_lineWidth * 0.5;
  float aa = 1.5 / max(cellPx, 1.0);
  float stroke = 1.0 - smoothstep(w - aa, w + aa, d);
  float glow = u_glow * exp(-max(d - w, 0.0) * 18.0);
  float flicker = 1.0 - u_flicker * (0.5 + 0.5 * sin(t * 6.0 + hash12(id) * TAU)) * 0.6;
  return vec4(vec3(saturate((stroke + glow) * flicker)), 1.0);
}
