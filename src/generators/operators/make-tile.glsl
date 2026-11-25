// Make It Tile: the image crossfaded with itself shifted by half a tile near its borders, so
// the edges meet a continuous copy (seamless). Blend width = size of the crossfade.
vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec4 a = texture(u_in_image, uv);
  vec4 b = texture(u_in_image, fract(uv + 0.5));
  vec2 edge = min(uv, 1.0 - uv);
  float w = max(u_blend, 1e-3) * 0.5;
  // 1 at the borders (only the continuous shifted copy shows), 0 inside.
  float k = max(1.0 - smoothstep(0.0, w, edge.x), 1.0 - smoothstep(0.0, w, edge.y));
  return mix(a, b, k);
}
