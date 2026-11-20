// Bricks / tiles with mortar, bevel and per-brick variation. Seamless.
vec4 generate(vec2 uv) {
  vec2 dims = vec2(float(u_columns), float(u_rows));
  vec2 g = uv * dims;
  float row = floor(g.y);
  g.x += mod(row, 2.0) * u_offset;
  vec2 c = floor(g);
  vec2 f = fract(g);
  // Distance to the brick border in uv units, so mortar is uniform on both axes.
  vec2 e = min(f, 1.0 - f) / dims;
  float d = min(e.x, e.y);
  float m = u_mortar * 0.05;
  float edge = smoothstep(m, m + u_bevel * 0.05 + 1e-4, d);
  float shade = mix(1.0, 0.4 + 0.6 * hash12(wrapCell(c, dims)), u_variation);
  float grain = 1.0 + u_noise * 0.3 * fbm(uv * 32.0, 3, 2.0, 0.5, vec2(32.0), 0.0, FBM_STANDARD);
  return vec4(vec3(saturate(edge * shade * grain)), 1.0);
}
