// Flood Fill to Gradient: a linear gradient across each island's box, at a random angle
// (within Angle variation) and with random levels: bevel-like or "random tilt" shading of
// bricks, plates and shards.
vec4 generate(vec2 uv) {
  vec4 d = ffData(uv);
  if (!ffIsland(d)) return vec4(vec3(0.0), 1.0);
  float a = radians(u_angle + (ffRandom(d, uv, 1.0) - 0.5) * 2.0 * u_angleRandom);
  vec2 dir = vec2(cos(a), sin(a));
  vec2 p = d.rg - 0.5;
  // Account for the box aspect so the gradient keeps its angle on long islands.
  vec2 aspect = d.ba / max(d.b, d.a);
  float extent = 0.5 * (abs(dir.x) * aspect.x + abs(dir.y) * aspect.y);
  float v = 0.5 + dot(p * aspect, dir) / max(extent * 2.0, 1e-4);
  float lo = mix(0.0, ffRandom(d, uv, 2.0) * 0.6, u_levelRandom);
  float hi = 1.0 - mix(0.0, ffRandom(d, uv, 3.0) * 0.6, u_levelRandom);
  return vec4(vec3(mix(lo, hi, saturate(v))), 1.0);
}
