// Laser / energy beam, tileable along its length.
vec4 generate(vec2 uv) {
  vec2 q = u_vertical ? uv.yx : uv;
  float y = q.y * 2.0 - 1.0;
  float freq = max(1.0, floor(u_noiseScale + 0.5));
  float n = fbm(vec2(q.x * freq - u_time * u_speed * freq, 0.37), 4, 2.0, 0.5,
                vec2(freq, 0.0), 0.0, FBM_STANDARD);
  float w = max(u_width * (1.0 + n * u_flicker), 1e-4);
  float d = abs(y);
  float glow = radialFalloff(d, w, u_falloff);
  float coreW = max(w * u_core, 1e-4);
  float core = 1.0 - smoothstep(coreW * 0.5, coreW, d);
  float v = max(glow, core);
  if (u_endFade > 0.0) v *= smoothstep(0.0, u_endFade, 1.0 - abs(q.x * 2.0 - 1.0));
  return vec4(vec3(saturate(v)), 1.0);
}
