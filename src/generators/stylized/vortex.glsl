// Portal / vortex: logarithmic spiral arms with noise, central hole and rim glow.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float r = length(p);
  float t = u_time * u_speed;
  float arms = float(u_arms);
  float spiral = atan(p.y, p.x) + u_twist * log(max(r, 1e-3)) + t;
  float bands = 0.5 + 0.5 * cos(spiral * arms);
  // Angular coordinate wraps by `freq` (integer) per turn, so the noise has no seam.
  float freq = arms * 2.0;
  float n = 0.5 + 0.5 * fbm(vec2(spiral / TAU * freq, r * u_noiseScale - t * 0.5), 4, 2.0, 0.5,
                            vec2(freq, 0.0), 0.0, FBM_STANDARD);
  float v = pow(saturate(mix(bands, bands * n * 1.6, u_noise)), u_sharpness);
  float hole = smoothstep(u_hole, u_hole + u_holeSoftness, r);
  float outer = 1.0 - smoothstep(u_radius - 0.15, u_radius, r);
  float rim = exp(-abs(r - u_hole) * 30.0) * u_rimGlow;
  return vec4(vec3(saturate(v * hole * outer + rim)), 1.0);
}
