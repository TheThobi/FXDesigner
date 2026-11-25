// Polar Coordinates: To polar wraps the image around the center (x → angle, y → radius:
// stripes become rings, speed lines radiate); From polar unrolls rings into stripes.
vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec2 p;
  if (u_mode == 0) {
    vec2 c = uv * 2.0 - 1.0;
    float a = atan(c.y, c.x) / TAU + 0.5;
    float r = length(c) / max(u_radius, 1e-3);
    p = vec2(fract(a * float(u_repeat) + r * u_twist), u_invert ? 1.0 - r : r);
    if (p.y < 0.0 || p.y > 1.0) return vec4(0.0);
  } else {
    float a = (uv.x / float(u_repeat) - 0.5) * TAU;
    float r = (u_invert ? 1.0 - uv.y : uv.y) * u_radius;
    p = vec2(cos(a), sin(a)) * r * 0.5 + 0.5;
  }
  return texture(u_in_image, p);
}
