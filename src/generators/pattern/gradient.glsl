// Basic gradients: linear, radial, angular, diamond, square; with repeat modes.
vec4 generate(vec2 uv) {
  vec2 p = rotate2d(centered(uv) - u_center, -radians(u_angle));
  float t;
  if (u_shape == 0) t = p.x * 0.5 + 0.5;
  else if (u_shape == 1) t = length(p);
  else if (u_shape == 2) t = atan(p.y, p.x) / TAU + 0.5;
  else if (u_shape == 3) t = abs(p.x) + abs(p.y);
  else t = max(abs(p.x), abs(p.y));
  t = t * u_scale + u_offset;
  if (u_repeat == 1) t = fract(t);
  else if (u_repeat == 2) t = 1.0 - abs(fract(t * 0.5) * 2.0 - 1.0);
  return vec4(vec3(saturate(t)), 1.0);
}
