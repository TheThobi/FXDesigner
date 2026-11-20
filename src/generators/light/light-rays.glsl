// Sunburst / god rays: noise around the angle drives irregular rays.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv) - u_center;
  float r = length(p);
  float count = float(u_count);
  float a = atan(p.y, p.x) / TAU + 0.5;
  float n = 0.5 + 0.5 * fbm(vec2(a * count, 0.5), u_detail, 2.0, 0.5, vec2(count, 0.0),
                            u_time * u_speed, FBM_STANDARD);
  float rays = pow(saturate(n * 1.3), u_sharpness);
  float v = rays * radialFalloff(r, u_length, u_falloff) + radialFalloff(r, u_core, 2.0);
  return vec4(vec3(saturate(v)), 1.0);
}
