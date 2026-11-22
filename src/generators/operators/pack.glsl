// Pack RGBA: four grayscale inputs (luminance) packed into one texture's channels — the
// usual way to ship several masks in a single game texture.
float channelOf(sampler2D tex, bool has, vec2 uv, float fallback) {
  if (!has) return fallback;
  vec4 c = texture(tex, uv);
  return luminance(c.rgb) * c.a;
}

vec4 generate(vec2 uv) {
  return vec4(channelOf(u_in_red, u_has_red, uv, u_redValue),
              channelOf(u_in_green, u_has_green, uv, u_greenValue),
              channelOf(u_in_blue, u_has_blue, uv, u_blueValue),
              u_preview ? 1.0 : channelOf(u_in_alpha, u_has_alpha, uv, u_alphaValue));
}
