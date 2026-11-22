// Unpack RGBA: shows the Image; its R, G, B and A channels are separate grayscale outputs.
vec4 generate(vec2 uv) {
  return u_has_image ? texture(u_in_image, uv) : vec4(0.0);
}
