// Cartoon cloud puff: smooth union of circles, cel-shaded with offset-SDF shadow/highlight
// bands and an ink outline. Tones: 0.1 outline, 0.4 shadow, 0.7 base, 1.0 highlight.
float smin(float a, float b, float k) {
  float h = saturate(0.5 + 0.5 * (b - a) / k);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float cloudSdf(vec2 p) {
  float d = length(p) - u_puffSize;
  for (int i = 0; i < 12; i++) {
    if (i >= u_puffs) break;
    float fi = float(i);
    float ang = (fi + 0.5 * hash12(vec2(fi, 1.0))) / float(u_puffs) * TAU;
    vec2 c = vec2(cos(ang), sin(ang) * u_squash) * u_spread * (0.6 + 0.4 * hash12(vec2(fi, 2.0)));
    float size = u_puffSize * (0.45 + 0.4 * hash12(vec2(fi, 3.0)));
    d = smin(d, length(p - c) - size, max(u_blend, 1e-3));
  }
  if (u_flatBottom) d = max(d, -(p.y + u_spread * u_squash * 0.6));
  return d;
}

vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float boil = floor(u_time * u_boil);
  p += u_wobble * 0.02 * vec2(gradientNoise(p * 4.0 + boil * 7.1, vec2(0.0), 0.0),
                              gradientNoise(p * 4.0 + boil * 3.3 + 5.0, vec2(0.0), 0.0));
  float aa = 2.0 / u_resolution.x;
  float d = cloudSdf(p);
  float mask = 1.0 - smoothstep(-aa, aa, d);
  vec2 l = vec2(cos(radians(u_lightAngle)), sin(radians(u_lightAngle)));
  float shadow = smoothstep(-aa, aa, cloudSdf(p - l * u_shadowOffset));
  float highlight = smoothstep(-aa, aa, cloudSdf(p + l * u_highlightOffset));
  float tone = mix(0.7, 0.4, shadow);
  tone = mix(tone, 1.0, highlight * (1.0 - shadow));
  tone = mix(tone, 0.1, smoothstep(-u_outlineWidth - aa, -u_outlineWidth + aa, d));
  return vec4(vec3(tone), mask);
}
