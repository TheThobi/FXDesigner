// Blend: Foreground over Background (straight alpha) with a blend mode, opacity and an
// optional Mask input. Modes follow operators/index.ts#BLEND_MODES.
vec3 blendRgb(vec3 b, vec3 t, int mode) {
  if (mode == 1) return b + t;
  if (mode == 2) return max(b - t, 0.0);
  if (mode == 3) return b * t;
  if (mode == 4) return 1.0 - (1.0 - b) * (1.0 - t);
  if (mode == 5) return mix(2.0 * b * t, 1.0 - 2.0 * (1.0 - b) * (1.0 - t), step(0.5, b));
  if (mode == 6) return max(b, t);
  if (mode == 7) return min(b, t);
  if (mode == 8) return abs(b - t);
  if (mode == 9) return b / max(t, 1e-3);
  return t;
}

vec4 generate(vec2 uv) {
  vec4 fg = u_has_foreground ? texture(u_in_foreground, uv) : vec4(0.0);
  vec4 bg = u_has_background ? texture(u_in_background, uv) : vec4(0.0);
  float k = u_opacity * fg.a;
  if (u_has_mask) {
    vec4 m = texture(u_in_mask, uv);
    float mv = saturate(luminance(m.rgb) * m.a);
    k *= u_invertMask ? 1.0 - mv : mv;
  }
  // Blend modes need a background; over transparency the foreground shows as is.
  vec3 c = mix(fg.rgb, blendRgb(bg.rgb, fg.rgb, u_mode), bg.a);
  float a = k + bg.a * (1.0 - k);
  vec3 rgb = (c * k + bg.rgb * bg.a * (1.0 - k)) / max(a, 1e-5);
  return vec4(rgb, a);
}
