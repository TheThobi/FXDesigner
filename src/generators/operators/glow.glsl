// Glow: the bright parts (above Threshold) blurred in a disc and added back, tinted.
// Golden-angle sampling (taps from the radius), wraps (seamless).
vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec4 base = texture(u_in_image, uv);
  float r = u_radius / 512.0;
  int taps = int(clamp(u_radius * 1.5, 16.0, 96.0));
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 96; i++) {
    if (i >= taps) break;
    float f = (float(i) + 0.5) / float(taps);
    float a = float(i) * 2.39996323;
    vec2 o = vec2(cos(a), sin(a)) * sqrt(f) * r;
    vec4 c = texture(u_in_image, fract(uv + o));
    float l = luminance(c.rgb) * c.a;
    float w = exp(-3.0 * f);
    sum += c.rgb * c.a * smoothstep(u_threshold, u_threshold + 0.1, l) * w;
    wsum += w;
  }
  vec3 glow = sum / wsum * u_intensity * u_tint;
  vec3 rgb = base.rgb * base.a + glow;
  float alpha = saturate(max(base.a, luminance(glow)));
  return vec4(alpha > 1e-5 ? rgb / alpha : vec3(0.0), alpha);
}
