// Flood Fill, output: one random value or color per island of the Mask (dark lines stay
// black), or the Data map read by the "Flood Fill to…" nodes: R, G = position in the
// island's box (0–1), B, A = box size (fraction of the image); A = 0 on the lines.
const float OFF = 1e6;

vec4 generate(vec2 uv) {
  if (!u_has_mask) return vec4(0.0);
  vec4 box = texture(u_prev, uv);
  if (box.x >= OFF) return u_output == 2 ? vec4(0.0) : vec4(vec3(0.0), 1.0);
  vec2 px = floor(uv * u_resolution);
  vec2 size = box.zw - box.xy + 1.0;
  if (u_output == 2) return vec4((-box.xy + 0.5) / size, size / u_resolution);
  // Island identity: its box corner (same for all its pixels).
  vec2 corner = mod(px + box.xy, u_resolution);
  float h = hash12(corner * 0.731 + 1.7);
  if (u_output == 1) return vec4(0.5 + 0.5 * cos(TAU * (h + vec3(0.0, 0.33, 0.67))), 1.0);
  return vec4(vec3(mix(u_minValue, u_maxValue, h)), 1.0);
}
