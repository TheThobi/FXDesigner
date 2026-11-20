// Fractal noise: fBm / turbulence / ridged multifractal, optionally seamless.
vec4 generate(vec2 uv) {
  float scale = u_tileable ? max(1.0, floor(u_scale + 0.5)) : u_scale;
  float lacunarity = u_tileable ? max(2.0, floor(u_lacunarity + 0.5)) : u_lacunarity;
  vec2 period = u_tileable ? vec2(scale) : vec2(0.0);
  float n = fbm(uv * scale, u_octaves, lacunarity, u_gain, period, u_time * u_speed, u_noiseType);
  float gain = u_noiseType == FBM_STANDARD ? 1.6 : 1.0;
  return vec4(vec3(saturate(0.5 + 0.5 * n * gain)), 1.0);
}
