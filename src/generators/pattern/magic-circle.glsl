// Magic circle: concentric rings, tick or rune band, star polygon, orbiting dots.
float ringLine(float r, float radius, float w, float aa) { return strokeMask(r - radius, w, aa); }

// Rune glyph: strokes between points of a 3x3 lattice (f in [0,1]^2), distance in cell units.
float runeGlyph(vec2 f, float id) {
  float d = 8.0;
  for (int k = 0; k < 4; k++) {
    vec2 h = floor(hash22(vec2(id, float(k) * 7.31)) * 3.0);
    vec2 h2 = floor(hash22(vec2(id, float(k) * 3.17 + 11.0)) * 3.0);
    if (h == h2) h2 = vec2(2.0) - h;
    d = min(d, sdSegment(f, 0.15 + h * 0.35, 0.15 + h2 * 0.35));
  }
  return d;
}

vec4 generate(vec2 uv) {
  vec2 p = rotate2d(centered(uv) / u_scale, radians(u_rotation));
  float aa = 2.0 / (u_resolution.x * u_scale);
  float w = u_lineWidth;
  float t = u_time * u_speed;
  float r = length(p);
  float v = 0.0;

  // Outer band: double ring with alternating long/short ticks.
  float outer = u_outerRadius;
  float bandInner = max(0.01, outer - u_bandWidth);
  if (u_outerBand) {
    v = max(v, ringLine(r, outer, w, aa));
    v = max(v, ringLine(r, bandInner, w, aa));
  }
  if (u_outerBand && u_bandStyle == 1) {
    // Rune band: one glyph per angular cell, as large as the band allows.
    vec2 q = rotate2d(p, t * 0.5);
    float count = float(u_runes);
    float a = (atan(q.y, q.x) / TAU + 0.5) * count;
    float mid = (outer + bandInner) * 0.5;
    float size = min(TAU * mid / count, outer - bandInner) * 0.7;
    vec2 f = vec2((fract(a) - 0.5) * TAU * mid / count, r - mid) / size + 0.5;
    if (all(greaterThanEqual(f, vec2(0.0))) && all(lessThanEqual(f, vec2(1.0)))) {
      float d = runeGlyph(f, mod(floor(a), count)) * size;
      v = max(v, strokeMask(d, w, aa));
    }
  }
  if (u_outerBand && u_bandStyle == 0 && u_ticks > 0) {
    vec2 q = rotate2d(p, t * 0.5);
    float a = atan(q.y, q.x);
    float sector = TAU / float(u_ticks);
    float k = floor(a / sector + 0.5);
    float d = r * abs(sin(a - k * sector));
    float inner = mod(k, 2.0) < 0.5 ? bandInner : (bandInner + outer) * 0.5;
    float band = step(inner, r) * step(r, outer);
    v = max(v, (1.0 - smoothstep(w * 0.5, w * 0.5 + aa, d)) * band);
  }

  // Star polygon and the polygon through its tips (counter-rotating).
  vec2 q = rotate2d(p, -t);
  float m = mix(2.0, float(u_sides), u_pointiness);
  if (u_starOn) {
    v = max(v, strokeMask(sdStar(q, u_starRadius, u_sides, m), w, aa));
    if (u_outlineOn) v = max(v, strokeMask(sdStar(q, u_starRadius, u_sides, 2.0), w, aa));
  }

  // Inner double ring with orbiting dots between the two lines.
  float ri = u_innerRadius;
  if (u_innerOn) {
    v = max(v, ringLine(r, ri, w, aa));
    v = max(v, ringLine(r, ri * (1.0 - u_innerGap), w * 0.7, aa));
  }
  if (u_dotsOn) {
    vec2 o = rotate2d(p, t * u_orbitSpeed);
    float sector = TAU / float(u_dotCount > 0 ? u_dotCount : u_sides);
    float k = floor(atan(o.y, o.x) / sector + 0.5);
    vec2 c = vec2(cos(k * sector), sin(k * sector)) * ri * (1.0 - u_innerGap * 0.5);
    v = max(v, fillMask(length(o - c) - ri * u_dotSize, aa));
  }
  if (u_spokes > 0) {
    float sector = TAU / float(u_spokes);
    float angle = atan(p.y, p.x);
    float d = r * abs(sin(angle - round(angle / sector) * sector));
    v = max(v, strokeMask(d, w, aa) * (1.0 - smoothstep(u_centerRadius - aa, u_centerRadius, r)));
  }

  float glow = u_outerBand ? u_glow * radialFalloff(abs(r - (outer + bandInner) * 0.5), 0.25, 3.0) : 0.0;
  return vec4(vec3(saturate(v + glow)), 1.0);
}
