// Blur, Gaussian passes: a hierarchical separable Gaussian. Pass i of u_passCount (= 2 per
// level) blurs horizontally (even) or vertically (odd) with sigma s0 * 2^level; the levels
// compose to the requested sigma (variances add). Each level's taps are spaced finer than the
// blur already applied, so a fixed tap count stays smooth at any radius (automatic sampling).
const int TAPS = 25;

vec4 generate(vec2 uv) {
  float sigma = max(u_radius, 1e-3) * 0.5 * max(u_resolution.x, u_resolution.y) / 512.0;
  int levels = max(u_passCount / 2, 1);
  int level = u_passIndex / 2;
  float s0 = sigma * sqrt(3.0 / (exp2(2.0 * float(levels)) - 1.0));
  float s = s0 * exp2(float(level));
  vec2 axis = u_passIndex % 2 == 0 ? vec2(1.0 / u_resolution.x, 0.0)
                                   : vec2(0.0, 1.0 / u_resolution.y);
  bool first = u_passIndex == 0;
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float t = (float(i) / float(TAPS - 1) * 2.0 - 1.0) * 3.0; // in sigmas
    float w = exp(-0.5 * t * t);
    vec2 p = fract(uv + axis * t * s);
    vec4 c;
    if (first) {
      c = texture(u_in_image, p);
      c = vec4(c.rgb * c.a, c.a); // premultiplied until the main pass
    } else {
      c = texture(u_prev, p);
    }
    sum += c * w;
    wsum += w;
  }
  return sum / wsum;
}
