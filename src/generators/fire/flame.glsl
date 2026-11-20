// Candle / torch flame: a tapered body displaced by upward-scrolling noise.
vec4 generate(vec2 uv) {
  float t = u_time * u_speed;
  float h = uv.y;
  float x = uv.x * 2.0 - 1.0;
  float n = 0.5 + 0.5 * fbm(vec2(uv.x * u_scale, uv.y * u_scale - t * 1.5), u_octaves, 2.0, 0.5,
                            vec2(0.0), t * 0.5, FBM_STANDARD);
  float disp = (n - 0.5) * u_turbulence * h * 2.0;
  float width = max(u_width * pow(max(1.0 - h / max(u_height, 1e-3), 0.0), u_taper), 1e-4);
  float shape = 1.0 - smoothstep(width * 0.2, width, abs(x + disp));
  float base = smoothstep(0.0, 0.12, h);
  float top = 1.0 - smoothstep(u_height * 0.6, u_height, h + (n - 0.5) * 0.4);
  float v = shape * base * top * (0.55 + 0.9 * n) * mix(1.25, 0.7, h) * u_intensity;
  return vec4(vec3(saturate(v)), 1.0);
}
