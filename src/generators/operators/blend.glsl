// Blend: Foreground over Background (straight alpha) with a blend mode, opacity and an
// optional Mask input. Modes follow operators/index.ts#BLEND_MODES.
vec4 blendChannels(vec4 b, vec4 t, int mode) {
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
  float amount = u_opacity;
  if (u_has_mask) {
    vec4 m = texture(u_in_mask, uv);
    float mv = saturate(luminance(m.rgb) * m.a);
    amount *= u_invertMask ? 1.0 - mv : mv;
  }
  if (u_mode != 0 && u_has_foreground && u_has_background) {
    bool fgRgba = u_channel_foreground < 0;
    bool bgRgba = u_channel_background < 0;
    bool fgRgb = u_channel_foreground == 4;
    bool bgRgb = u_channel_background == 4;
    vec4 base = bg;
    // Scalar pins broadcast to alpha when paired with RGBA. RGB has no alpha.
    if (!fgRgba && !fgRgb && bgRgba) fg.a = fg.r;
    if (!bgRgba && !bgRgb && fgRgba) bg.a = bg.r;
    vec4 result = blendChannels(bg, fg, u_mode);
    if (fgRgb && bgRgba) result.a = bg.a;
    else if (bgRgb && fgRgba) result.a = fg.a;
    else if (!fgRgba && !bgRgba) result.a = 1.0;
    result = mix(base, result, amount);
    return vec4(result.rgb, saturate(result.a));
  }

  float k = amount * fg.a;
  float a = k + bg.a * (1.0 - k);
  vec3 rgb = (fg.rgb * k + bg.rgb * bg.a * (1.0 - k)) / max(a, 1e-5);
  return vec4(rgb, a);
}
