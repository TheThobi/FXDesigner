// Lightning bolts: fBm displacement along a vertical axis.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float strike = u_restrike ? floor(u_time * u_strikeRate) : 0.0;
  float phase = u_restrike ? 0.0 : u_time * u_waveSpeed;
  float y = uv.y * 2.0 - 1.0;
  float env = u_pinEnds ? 1.0 - y * y : 1.0;
  float v = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= u_bolts) break;
    float fi = float(i);
    vec2 off = vec2(fi * 17.13 + strike * 7.31, fi * 3.71 + strike * 1.37);
    float x = fbm(vec2(p.y * u_frequency, phase) + off, u_octaves, 2.0, 0.55, vec2(0.0), 0.0, FBM_STANDARD);
    float d = abs(p.x - x * u_amplitude * env);
    float w = u_thickness * (i == 0 ? 1.0 : 0.6);
    v += 1.0 - smoothstep(w * 0.5, w, d);
    v += 0.5 * radialFalloff(d, u_glow, 3.0);
  }
  return vec4(vec3(saturate(v)), 1.0);
}
