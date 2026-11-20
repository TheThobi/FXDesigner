// Soft smoke puff with noisy silhouette and inner density variation.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float t = u_time * u_speed;
  float n = 0.5 + 0.5 * fbm(p * u_scale + vec2(0.0, -t), u_octaves, 2.0, 0.5, vec2(0.0), t * 0.5,
                            FBM_STANDARD);
  float r = length(p) + (n - 0.5) * u_turbulence;
  float mask = 1.0 - smoothstep(u_radius * (1.0 - u_softness), u_radius, r);
  float v = mask * mix(1.0, n * 1.6, u_detail) * u_density;
  return vec4(vec3(saturate(v)), 1.0);
}
