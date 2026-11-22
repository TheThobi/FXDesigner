// Slope Blur (Substance Designer): each pixel walks along the gradient of the Slope input and
// accumulates the Image (average, min or max) — painterly smears, eroded edges.
float slopeLum(vec2 uv) {
  vec4 c = texture(u_in_slope, uv);
  return luminance(c.rgb) * c.a;
}

vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  if (!u_has_slope) return texture(u_in_image, uv);
  float stepLen = u_intensity / 512.0 / float(u_samples);
  vec2 p = uv;
  vec4 acc = texture(u_in_image, p);
  vec4 lo = acc;
  vec4 hi = acc;
  float n = 1.0;
  float e = 1.5 / 512.0;
  for (int i = 0; i < 32; i++) {
    if (i >= u_samples) break;
    vec2 g = vec2(slopeLum(p + vec2(e, 0.0)) - slopeLum(p - vec2(e, 0.0)),
                  slopeLum(p + vec2(0.0, e)) - slopeLum(p - vec2(0.0, e)));
    float len = length(g);
    if (len < 1e-6) break;
    p = fract(p + g / len * stepLen);
    vec4 c = texture(u_in_image, p);
    acc += c;
    n += 1.0;
    lo = min(lo, c);
    hi = max(hi, c);
  }
  if (u_mode == 1) return lo;
  if (u_mode == 2) return hi;
  return acc / n;
}
