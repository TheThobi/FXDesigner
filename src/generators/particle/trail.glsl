// Trail / ribbon texture for trail renderers: a bright core band fading to the edges, broken
// by noise and streaks scrolling along U. Seamless along X (unless "Fade end" is on).
vec4 generate(vec2 uv) {
  float y = uv.y * 2.0 - 1.0;
  float t = u_time * u_speed;
  float freq = max(1.0, floor(u_noiseScale + 0.5));
  float n = 0.5 + 0.5 * fbm(vec2(uv.x * freq - t * freq, y * 2.0 + 3.0), 4, 2.0, 0.5, vec2(freq, 0.0), 0.0, FBM_STANDARD);
  float s = 0.5 + 0.5 * fbm(vec2(uv.x * freq - t * freq * 1.5, y * u_streaks), 3, 2.0, 0.5, vec2(freq, 0.0), 0.0, FBM_STANDARD);
  float width = u_width * (1.0 + (n - 0.5) * u_breakup);
  float band = radialFalloff(abs(y), width, u_falloff);
  float core = 1.0 - smoothstep(width * u_core * 0.5, width * u_core, abs(y));
  float v = max(band * mix(1.0, s * 1.5, u_streakAmount), core);
  if (u_fadeEnd) v *= 1.0 - smoothstep(0.2, 1.0, uv.x);
  return vec4(vec3(saturate(v)), 1.0);
}
