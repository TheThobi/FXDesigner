// Magic orb: a swirling energy sphere with a bright rim, outer halo and orbiting motes.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float r = length(p);
  float t = u_time * u_speed;
  float body = 1.0 - smoothstep(u_radius * 0.94, u_radius, r);
  vec2 q = rotate2d(p, t * 0.6 + r * u_swirl * 5.0);
  float energy = 0.5 + 0.5 * fbm(q * 4.0 + vec2(t * 0.4, 0.0), 4);
  float rim = smoothstep(u_radius * 0.55, u_radius, r) * body;
  float inner = body * (0.3 + 0.7 * energy * (0.35 + rim));
  float halo = u_glow * exp(-max(r - u_radius, 0.0) * 9.0 / max(u_glow, 0.05)) * (1.0 - body);
  float motes = 0.0;
  for (int i = 0; i < 24; i++) {
    if (i >= u_motes) break;
    float fi = float(i);
    float h = hash12(vec2(fi, 4.7));
    float a = fi / float(u_motes) * TAU + t * (0.5 + 0.6 * h);
    float orbit = u_orbit * (0.8 + 0.4 * hash12(vec2(fi, 1.9)));
    vec2 pos = vec2(cos(a), sin(a) * 0.45) * orbit;
    pos = rotate2d(pos, h * 0.8 - 0.4);
    float behind = sin(a) > 0.0 && length(pos) < u_radius ? 0.25 : 1.0;
    float d = length(p - pos) / max(u_moteSize, 1e-3);
    motes = max(motes, exp(-d * d) * behind);
  }
  return vec4(vec3(saturate(max(inner + halo, motes))), 1.0);
}
