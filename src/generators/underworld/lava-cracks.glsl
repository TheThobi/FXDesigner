// Glowing fissures in dark rock (seamless): exact Voronoi borders become cracks with a hot
// core and soft glow; rock plates get subtle noise and heat pulses travel along the cracks.
vec4 generate(vec2 uv) {
  float t = u_time * u_speed;
  float s = max(1.0, floor(u_scale + 0.5));
  vec2 period = vec2(s);
  vec2 q = uv * s;
  q += vec2(fbm(uv * s * 1.5, 3, 2.0, 0.5, period * 1.5, 0.0, FBM_STANDARD),
            fbm(uv * s * 1.5 + 7.0, 3, 2.0, 0.5, period * 1.5, 0.0, FBM_STANDARD)) * u_jagged * 0.25;
  vec4 v = voronoiNearest(q, period, 1.0);
  float border = v.z;
  float w = u_crackWidth;
  float core = 1.0 - smoothstep(w * 0.3, w * 0.6, border);
  float glow = exp(-max(border - w * 0.3, 0.0) / max(u_glow * 0.15, 1e-3)) * u_glow;
  float pulse = 0.75 + 0.25 * sin(t * 2.0 + v.w * TAU + uv.x * 6.283);
  float heat = mix(1.0, 0.5 + v.w, u_heatVariation);
  float rock = 0.08 + 0.1 * (0.5 + 0.5 * fbm(uv * s * 6.0, 4, 2.0, 0.5, period * 6.0, 0.0, FBM_STANDARD)) * u_rockDetail;
  float lava = saturate(core + glow * 0.7) * heat * pulse;
  return vec4(vec3(saturate(max(rock, lava))), 1.0);
}
