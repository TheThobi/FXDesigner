// Magic circle: concentric rings, tick band, star polygon, orbiting dots.
float ringLine(float r, float radius, float w, float aa) { return strokeMask(r - radius, w, aa); }

vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float aa = 2.0 / u_resolution.x;
  float w = u_lineWidth;
  float t = u_time * u_speed;
  float r = length(p);
  float v = 0.0;

  // Outer band: double ring with alternating long/short ticks.
  v = max(v, ringLine(r, 0.92, w, aa));
  v = max(v, ringLine(r, 0.80, w, aa));
  if (u_ticks > 0) {
    vec2 q = rotate2d(p, t * 0.5);
    float a = atan(q.y, q.x);
    float sector = TAU / float(u_ticks);
    float k = floor(a / sector + 0.5);
    float d = r * abs(sin(a - k * sector));
    float inner = mod(k, 2.0) < 0.5 ? 0.80 : 0.86;
    float band = step(inner, r) * step(r, 0.92);
    v = max(v, (1.0 - smoothstep(w * 0.5, w * 0.5 + aa, d)) * band);
  }

  // Star polygon and the polygon through its tips (counter-rotating).
  vec2 q = rotate2d(p, -t);
  float m = mix(2.0, float(u_sides), u_pointiness);
  v = max(v, strokeMask(sdStar(q, 0.80, u_sides, m), w, aa));
  v = max(v, strokeMask(sdStar(q, 0.80, u_sides, 2.0), w, aa));

  // Inner double ring with orbiting dots between the two lines.
  float ri = u_innerRadius;
  v = max(v, ringLine(r, ri, w, aa));
  v = max(v, ringLine(r, ri * 0.82, w * 0.7, aa));
  vec2 o = rotate2d(p, t * 1.5);
  float sector = TAU / float(u_sides);
  float k = floor(atan(o.y, o.x) / sector + 0.5);
  vec2 c = vec2(cos(k * sector), sin(k * sector)) * ri * 0.91;
  v = max(v, fillMask(length(o - c) - ri * 0.05, aa));

  float glow = u_glow * radialFalloff(abs(r - 0.86), 0.25, 3.0);
  return vec4(vec3(saturate(v + glow)), 1.0);
}
