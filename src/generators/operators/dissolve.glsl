// Dissolve (animation): the Image appears and disappears over time through a threshold on the
// Pattern input (noise, gradient, Distance…; a left-to-right wipe without one), with a
// glowing burning edge.
vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec4 c = texture(u_in_image, uv);
  float m = u_has_pattern ? luminance(texture(u_in_pattern, uv).rgb) : uv.x;
  if (u_invert) m = 1.0 - m;
  float t = fract(u_time * u_speed);
  if (u_pingPong) t = 1.0 - abs(t * 2.0 - 1.0);
  // The threshold sweeps past both ends so the image is fully shown and fully gone.
  float edge = max(u_edge, 1e-3);
  float threshold = mix(-edge, 1.0, t);
  float d = m - threshold;
  float visible = smoothstep(0.0, 0.004, d);
  float rim = (1.0 - smoothstep(0.0, edge, d)) * visible;
  return vec4(c.rgb + u_glowColor * rim * u_glow, c.a * visible);
}
