// Distance, jump flood step: each pixel keeps the nearest seed among its 3x3 neighbours at
// the current step (halved every iteration, then a final step of 1). Wraps when tiling.
vec2 seedDelta(vec2 p, vec2 seed) {
  vec2 d = seed - p;
  if (u_tile) d -= u_resolution * floor(d / u_resolution + 0.5);
  return d;
}

vec4 generate(vec2 uv) {
  vec2 p = floor(gl_FragCoord.xy);
  int k = u_passCount - 2 - u_passIndex;
  float stepPx = k >= 0 ? exp2(float(k)) : 1.0;
  vec4 best = vec4(-1.0);
  vec2 bestD = vec2(1e20);
  ivec2 size = ivec2(u_resolution);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 q = p + vec2(float(x), float(y)) * stepPx;
      if (u_tile) q = mod(q, u_resolution);
      else if (q.x < 0.0 || q.y < 0.0 || q.x >= u_resolution.x || q.y >= u_resolution.y) continue;
      vec4 s = texelFetch(u_prev, clamp(ivec2(q), ivec2(0), size - 1), 0);
      if (s.x >= 0.0) {
        float d = dot(seedDelta(p, s.xy), seedDelta(p, s.xy));
        if (d < bestD.x) { bestD.x = d; best.xy = s.xy; }
      }
      if (s.z >= 0.0) {
        float d = dot(seedDelta(p, s.zw), seedDelta(p, s.zw));
        if (d < bestD.y) { bestD.y = d; best.zw = s.zw; }
      }
    }
  }
  return best;
}
