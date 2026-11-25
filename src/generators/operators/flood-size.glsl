// Flood Fill to Size: each island valued by the size of its box (largest side or area),
// scaled: small pieces dark, big ones bright (or the reverse).
vec4 generate(vec2 uv) {
  vec4 d = ffData(uv);
  if (!ffIsland(d)) return vec4(vec3(0.0), 1.0);
  float s = u_mode == 0 ? max(d.b, d.a) : sqrt(d.b * d.a);
  float v = saturate(s * u_scale);
  return vec4(vec3(u_invert ? 1.0 - v : v), 1.0);
}
