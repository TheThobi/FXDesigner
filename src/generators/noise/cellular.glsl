// Cellular (Worley / Voronoi) noise with several outputs.
vec4 generate(vec2 uv) {
  float scale = u_tileable ? max(1.0, floor(u_scale + 0.5)) : u_scale;
  vec2 period = u_tileable ? vec2(scale) : vec2(0.0);
  vec3 c = voronoi(uv * scale, period, u_jitter, u_time * u_speed * TAU, u_metric);
  float edgeW = max(u_edgeWidth, 1e-4);
  float border = smoothstep(0.0, edgeW, c.y - c.x);
  float v;
  if (u_mode == 0) v = c.x;                          // F1: distance to nearest point
  else if (u_mode == 1) v = c.y * 0.75;              // F2
  else if (u_mode == 2) v = 1.0 - border;            // edges as bright lines
  else if (u_mode == 3) v = c.z;                     // flat cells
  else v = (0.35 + 0.65 * c.z) * border;             // stones: flat cells with dark mortar
  return vec4(vec3(saturate(v)), 1.0);
}
