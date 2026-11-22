// Color Cycle (animation): palette cycling. The brightness scrolls through the node's color
// ramp over time (the Post Process gradient map colors it): lava, water, energy, neon signs.
vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec4 c = texture(u_in_image, uv);
  float v = fract(luminance(c.rgb) * float(u_repeats) - u_time * u_speed);
  // Mirrored: the ramp goes there and back, so there is no hard jump at its ends.
  if (u_mirror) v = 1.0 - abs(v * 2.0 - 1.0);
  return vec4(vec3(v), c.a);
}
