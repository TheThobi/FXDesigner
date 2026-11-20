// Polygon / star shape, filled or outlined, with optional glow.
vec4 generate(vec2 uv) {
  vec2 p = rotate2d(centered(uv), radians(u_rotation) + u_time * u_speed);
  float m = mix(2.0, float(u_sides), clamp(u_pointiness, 0.0, 0.95));
  float d = sdStar(p, u_radius, u_sides, m);
  float aa = max(u_softness, 1.5 / u_resolution.x);
  float v = u_outline ? strokeMask(d, u_outlineWidth, aa) : fillMask(d, aa);
  if (u_glow > 0.0) {
    float outside = u_outline ? abs(d) - u_outlineWidth * 0.5 : d;
    v = max(v, 0.6 * radialFalloff(max(outside, 0.0), u_glow, 3.0));
  }
  return vec4(vec3(saturate(v)), 1.0);
}
