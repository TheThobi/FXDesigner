// Mirror / Symmetry: one side of the image reflected onto the other (X, Y or both, around a
// movable axis), or N mirrored sectors around a center (kaleidoscope of any input).
vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec2 p = uv;
  float side = u_flip ? -1.0 : 1.0;
  if (u_mode == 0 || u_mode == 2) p.x = u_axis.x + side * abs(p.x - u_axis.x);
  if (u_mode == 1 || u_mode == 2) p.y = u_axis.y + side * abs(p.y - u_axis.y);
  if (u_mode == 3) {
    vec2 c = p - u_axis;
    float seg = TAU / float(u_segments);
    float rot = radians(u_rotation);
    float a = mod(atan(c.y, c.x) - rot, seg);
    if (a > seg * 0.5) a = seg - a;
    p = u_axis + vec2(cos(a + rot), sin(a + rot)) * length(c);
  }
  return texture(u_in_image, u_wrap ? fract(p) : clamp(p, 0.0, 1.0));
}
