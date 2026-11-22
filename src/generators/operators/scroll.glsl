// Scroll (animation): pans the image over time, wrapping around (seamless inputs scroll
// endlessly), with an optional sway (horizontal waves travelling down, like a flag or heat).
// Speeds in tiles per second.
vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec2 offset = vec2(u_speedX, u_speedY) * u_time;
  offset.x += u_sway * 0.05 * sin(TAU * (uv.y * float(u_swayWaves) - u_time * u_swaySpeed));
  return texture(u_in_image, fract(uv - offset));
}
