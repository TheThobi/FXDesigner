// Radial Blur: Zoom (streaks toward / away from a center, god rays) or Spin (around it).
// Taps follow the length of the streak.
vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec2 d = uv - u_center;
  float len = u_mode == 0 ? length(d) * u_strength : length(d) * radians(u_strength * 30.0);
  int taps = int(clamp(len * max(u_resolution.x, u_resolution.y) * 0.5, 4.0, 64.0));
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= taps) break;
    float t = float(i) / float(max(taps - 1, 1));
    vec2 p;
    if (u_mode == 0) p = u_center + d * (1.0 - t * u_strength);
    else p = u_center + rotate2d(d, (t - 0.5) * radians(u_strength * 30.0));
    vec4 c = texture(u_in_image, u_wrap ? fract(p) : clamp(p, 0.0, 1.0));
    float w = 1.0 - t * 0.5;
    sum += vec4(c.rgb * c.a, c.a) * w;
    wsum += w;
  }
  sum /= wsum;
  return sum.a > 1e-5 ? vec4(sum.rgb / sum.a, sum.a) : vec4(0.0);
}
