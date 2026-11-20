// Top-down liquid splash: an expanding crown ring and teardrop droplets flying outward,
// stretched along their motion. Loops over time (or frozen at Progress when Speed = 0).
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float t = u_speed > 0.0 ? fract(u_time * u_speed) : u_progress;
  float r = length(p);
  float rr = mix(0.08, u_ringRadius, sqrt(t));
  float rw = max(u_ringWidth * (1.0 - t * 0.6), 1e-3);
  float ring = exp(-pow((r - rr) / rw, 2.0)) * (1.0 - t);
  float v = ring;
  for (int i = 0; i < 32; i++) {
    if (i >= u_drops) break;
    float fi = float(i);
    float h = hash12(vec2(fi, 7.3));
    float a = (fi + 0.6 * h) / float(u_drops) * TAU;
    vec2 dir = vec2(cos(a), sin(a));
    float dist = mix(0.12, u_spread, t * (0.55 + 0.45 * h));
    vec2 q = p - dir * dist;
    float along = dot(q, dir);
    float side = dot(q, vec2(-dir.y, dir.x));
    float size = u_dropSize * (0.5 + 0.8 * hash12(vec2(fi, 2.1))) * (1.0 - t * 0.75);
    float stretch = 1.0 + u_stretch * (1.0 - t);
    float d = length(vec2(along < 0.0 ? along / stretch : along, side)) / max(size, 1e-4);
    v = max(v, 1.0 - smoothstep(0.75, 1.0, d));
  }
  return vec4(vec3(saturate(v)), 1.0);
}
