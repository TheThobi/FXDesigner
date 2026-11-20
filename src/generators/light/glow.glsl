// Soft radial glow with optional hot core and angular distortion.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv) - u_center;
  float r = length(p);
  float n = u_distortion > 0.0 ? polarNoise(p, 6.0, u_time * u_speed, 4) : 0.0;
  float glow = radialFalloff(r * (1.0 + n * u_distortion), u_radius, u_falloff);
  float core = u_core > 0.0 ? 1.0 - smoothstep(0.0, u_core, r) : 0.0;
  return vec4(vec3(saturate(glow * u_intensity + core)), 1.0);
}
