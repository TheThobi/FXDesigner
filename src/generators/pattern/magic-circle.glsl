// Magic circle: concentric rings, tick band, star polygon, orbiting dots.
float ringLine(float r, float radius, float w, float aa) { return strokeMask(r - radius, w, aa); }

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
  if (u_outerBand && u_ticks > 0) {
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
