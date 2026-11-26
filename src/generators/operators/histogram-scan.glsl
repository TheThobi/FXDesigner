// Histogram Scan (Substance-like): a soft threshold of the brightness. Position moves the cut
// through the tones (keyframe it to reveal or dissolve a mask), Contrast sharpens it.
vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec4 c = texture(u_in_image, uv);
  float w = max((1.0 - u_contrast) * 0.5, 1e-4);
  // Position 0 keeps everything white, 1 everything black.
  float cut = mix(-w, 1.0 + w, u_position);
  float v = smoothstep(cut - w, cut + w, luminance(c.rgb));
  if (u_invert) v = 1.0 - v;
  return vec4(vec3(v), c.a);
}
