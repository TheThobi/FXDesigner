// Regular patterns: checker, stripes, dots, grid. Seamless when rotation is 0 or 90.
vec4 generate(vec2 uv) {
  vec2 g = rotate2d(uv - 0.5, radians(u_rotation)) * float(u_tiles);
  vec2 f = fract(g);
  vec2 c = floor(g);
  float soft = max(u_softness, 1e-4);
  float w = u_size;
  float v;
  if (u_pattern == 0) {
    v = mod(c.x + c.y, 2.0);
  } else if (u_pattern == 1) {
    v = 1.0 - smoothstep(w - soft, w + soft, abs(f.x - 0.5) * 2.0);
  } else if (u_pattern == 2) {
    v = 1.0 - smoothstep(w - soft, w + soft, length(f - 0.5) * 2.0);
  } else {
    vec2 e = min(f, 1.0 - f) * 2.0;
    v = 1.0 - smoothstep(w * 0.5 - soft, w * 0.5 + soft, min(e.x, e.y));
  }
  return vec4(vec3(v), 1.0);
}
