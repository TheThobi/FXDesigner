// Flood Fill, spread passes: each island pixel grows its bounding box with those found by
// walking up to 16 pixels in the 4 directions without leaving the island (a neighbour's box,
// relative to it, is shifted by its offset). Repeated until the whole island agrees. Wraps
// (islands crossing the edges join); boxes stay within one tile.
const float OFF = 1e6;

vec4 generate(vec2 uv) {
  vec4 box = texture(u_prev, uv);
  if (box.x >= OFF) return box;
  vec2 texel = 1.0 / u_resolution;
  for (int d = 0; d < 4; d++) {
    vec2 dir = d == 0 ? vec2(1.0, 0.0) : d == 1 ? vec2(-1.0, 0.0) : d == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
    for (int i = 1; i <= 16; i++) {
      vec2 k = dir * float(i);
      vec4 n = texture(u_prev, fract(uv + k * texel));
      if (n.x >= OFF) break;
      box = vec4(min(box.xy, n.xy + k), max(box.zw, n.zw + k));
    }
  }
  vec2 limit = u_resolution;
  return vec4(max(box.xy, -limit), min(box.zw, limit));
}
