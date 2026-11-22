// Transform 2D: tile, rotate, scale, flip and offset the Image. Wrap keeps it seamless (with
// whole tiles and right-angle rotations); otherwise the outside is transparent.
vec4 generate(vec2 uv) {
  vec2 c = uv - 0.5 - u_offset;
  c = rotate2d(c, -radians(u_rotation)) / max(u_scale, 1e-3);
  if (u_flipX) c.x = -c.x;
  if (u_flipY) c.y = -c.y;
  vec2 p = (c + 0.5) * float(u_tile);
  if (!u_wrap && (p.x < 0.0 || p.x > float(u_tile) || p.y < 0.0 || p.y > float(u_tile)))
    return vec4(0.0);
  return u_has_image ? texture(u_in_image, fract(p)) : vec4(0.0);
}
