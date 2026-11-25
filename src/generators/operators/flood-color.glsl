// Flood Fill to Color: each island takes the color of the Image at its center (mosaic,
// stained glass); optional random brightness per island.
vec4 generate(vec2 uv) {
  vec4 d = ffData(uv);
  if (!ffIsland(d)) return vec4(vec3(0.0), u_keepLines ? 1.0 : 0.0);
  vec4 c = u_has_image ? texture(u_in_image, ffCenter(d, uv)) : vec4(vec3(ffRandom(d, uv, 4.0)), 1.0);
  c.rgb *= mix(1.0, 0.6 + 0.8 * ffRandom(d, uv, 5.0), u_lumRandom);
  return vec4(saturate(c.rgb), c.a);
}
