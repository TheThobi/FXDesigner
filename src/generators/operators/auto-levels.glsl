vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec4 src = texture(u_in_image, uv);
  if (u_strength == 0.0) return src;
  vec3 range = texelFetch(u_prev, ivec2(0), 0).rgb;
  if (range.z < 0.5 || range.y - range.x < 0.001) return src;
  if (u_ignoreTransparent && src.a <= 0.0) return src;

  vec3 color = saturate(src.rgb);
  float lum = luminance(color);
  float level = saturate((lum - range.x) / (range.y - range.x));
  float target = mix(u_outBlack, u_outWhite, level);
  // Move along the line to black or white to preserve hue and stay inside the RGB gamut.
  vec3 adjusted = target < lum
    ? color * (target / max(lum, 1e-6))
    : mix(color, vec3(1.0), (target - lum) / max(1.0 - lum, 1e-6));
  return vec4(mix(src.rgb, adjusted, u_strength), src.a);
}
