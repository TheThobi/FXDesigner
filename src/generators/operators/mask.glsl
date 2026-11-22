// Mask: the Mask input (luminance, alpha or red, remapped by its levels) multiplies the
// Image's opacity.
vec4 generate(vec2 uv) {
  vec4 c = u_has_image ? texture(u_in_image, uv) : vec4(0.0);
  vec4 m = u_has_mask ? texture(u_in_mask, uv) : vec4(1.0);
  float v = u_channel == 0 ? luminance(m.rgb) * m.a : u_channel == 1 ? m.a : m.r;
  v = smoothstep(u_low, max(u_high, u_low + 1e-3), v);
  if (u_invert) v = 1.0 - v;
  return vec4(c.rgb, c.a * v);
}
