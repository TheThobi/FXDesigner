// Output / Reroute: the connected image, untouched (transparent when nothing is connected).
vec4 generate(vec2 uv) {
  return u_has_image ? texture(u_in_image, uv) : vec4(0.0);
}
