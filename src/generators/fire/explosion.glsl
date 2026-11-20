// Fireball: polar noise scrolling outward, blended with cartesian noise near the center to
// hide the polar pinch.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float r = length(p);
  float t = u_time * u_speed;
  float freq = 8.0;
  float a = atan(p.y, p.x) / TAU + 0.5;
  float np = 0.5 + 0.5 * fbm(vec2(a * freq, r * u_scale - t), u_octaves, 2.0, 0.5,
                             vec2(freq, 0.0), t * 0.3, FBM_STANDARD);
  float nc = 0.5 + 0.5 * fbm(p * u_scale * 0.5 + vec2(3.1, -t * 0.3), u_octaves, 2.0, 0.5,
                             vec2(0.0), t * 0.3, FBM_STANDARD);
  float n = mix(np, nc, smoothstep(0.4, 0.0, r));
  float edge = u_radius * (1.0 + (n - 0.5) * u_turbulence);
  float body = saturate(1.0 - r / max(edge, 1e-4));
  float v = pow(body, u_falloff) * (0.4 + 1.2 * n) + pow(body, 4.0) * u_coreHeat;
  return vec4(vec3(saturate(v)), 1.0);
}
