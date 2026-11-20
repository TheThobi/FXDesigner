// Cellular (Worley / Voronoi) noise with several outputs. Edge modes use the exact border
// distance, so line widths are uniform.
vec4 generate(vec2 uv) {
  float scale = u_tileable ? max(1.0, floor(u_scale + 0.5)) : u_scale;
  vec2 period = u_tileable ? vec2(scale) : vec2(0.0);
  float flow = u_time * u_speed * TAU;
  vec2 p = uv * scale;
  vec3 c = voronoi(p, period, u_jitter, flow, u_metric);
  float border = voronoiNearest(p, period, u_jitter, flow).z;
  float aa = scale * 1.5 / u_resolution.x;
  float edgeW = max(u_edgeWidth * 0.5, 1e-4);
  float inside = smoothstep(edgeW - aa, edgeW + aa, border);
  float v;
  if (u_mode == 0) v = c.x;                          // F1: distance to nearest point
  else if (u_mode == 1) v = c.y * 0.75;              // F2
  else if (u_mode == 2) v = 1.0 - inside;            // edges as bright lines
  else if (u_mode == 3) v = c.z;                     // flat cells
  else v = (0.35 + 0.65 * c.z) * inside;             // stones: flat cells with dark mortar
  return vec4(vec3(saturate(v)), 1.0);
}
