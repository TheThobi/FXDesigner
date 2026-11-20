// Ring / shockwave with glow, distortion and dashed segments.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float r = length(p);
  float n = u_distortion > 0.0 ? polarNoise(p, 8.0, u_time * u_speed, 4) : 0.0;
  float radius = u_radius * (1.0 + n * u_distortion * 0.2);
  float d = abs(r - radius);
  float halfW = u_thickness * 0.5;
  float aa = 2.0 / u_resolution.x;
  float core = 1.0 - smoothstep(halfW, halfW + aa, d);
  float glow = pow(saturate(1.0 - (d - halfW) / max(u_glow, 1e-4)), 2.0);
  float v = max(core, glow * 0.7);
  if (u_segments > 0) {
    float a = atan(p.y, p.x) / TAU + 0.5 + u_time * u_rotationSpeed;
    float s = fract(a * float(u_segments));
    float gap = u_gap;
    v *= smoothstep(0.0, 0.01, s) * (1.0 - smoothstep(1.0 - gap - 0.01, 1.0 - gap, s));
  }
  return vec4(vec3(saturate(v)), 1.0);
}
