// Non-uniform Blur: a disc blur whose radius follows a mask (white = full Radius, black =
// sharp): depth-of-field-like falloffs, blurry edges, soft-focus areas. Golden-angle taps.
vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  float m = 1.0;
  if (u_has_mask) {
    vec4 k = texture(u_in_mask, uv);
    m = luminance(k.rgb) * k.a;
  }
  if (u_invertMask) m = 1.0 - m;
  float refPx = max(u_resolution.x, u_resolution.y) / 512.0;
  float radiusPx = u_radius * m * refPx;
  if (radiusPx < 0.5) return texture(u_in_image, uv);
  vec2 r = vec2(radiusPx) / u_resolution;
  int n = int(clamp(radiusPx * 4.0, 8.0, 96.0));
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 96; i++) {
    if (i >= n) break;
    float t = (float(i) + 0.5) / float(n);
    float a = float(i) * 2.39996323;
    vec2 q = uv + vec2(cos(a), sin(a)) * sqrt(t) * r;
    vec4 c = texture(u_in_image, u_wrap ? fract(q) : clamp(q, 0.0, 1.0));
    sum += vec4(c.rgb * c.a, c.a);
  }
  sum /= float(n);
  return sum.a > 1e-5 ? vec4(sum.rgb / sum.a, sum.a) : vec4(0.0);
}
