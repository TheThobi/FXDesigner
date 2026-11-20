// Underworld soul flame: a tall, swaying flame field cut into flat stacked tones (dark rim,
// body, bright heart). Holes in the noise near the tip detach wisps that drift upward.
float soulField(vec2 p, float t) {
  float y = p.y / (1.8 * u_height);
  float sway = sin(y * 4.0 * u_waviness - t * 2.0) * 0.1 * u_waviness * saturate(y);
  float x = p.x - sway;
  float w = u_width * mix(1.0, 0.15, saturate(y));
  float r = length(vec2(x / max(w, 1e-3), min(y, 0.0) / 0.1));
  float silhouette = 1.0 - smoothstep(0.0, 1.0, r);
  vec2 q = vec2(x * 4.0, p.y * 1.6 - t * 1.4);
  q.x += sin(q.y * 1.5 + t) * 0.6 * u_waviness;
  float n = saturate(0.5 + 1.6 * fbm(q, 4));
  float breakup = float(u_wisps) / 6.0;
  return silhouette * (1.1 - y * (1.0 - 0.4 * breakup)) - (1.0 - n) * (0.8 + breakup * 0.8) * saturate(y + 0.2) - 0.1;
}

vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  p.y += 0.75;
  float t = u_time * u_speed;
  float f = soulField(p, t);
  float aa = clamp(fwidth(f) * 1.2, 1e-4, 0.03);
  float mask = smoothstep(-aa, aa, f);
  float bands = float(u_bands);
  // Flat tones: quantize the field depth, anti-aliased at each step.
  float depth = saturate(f * 2.2) * (bands - 1.0);
  float step0 = floor(depth);
  float fracStep = smoothstep(1.0 - aa * 2.2 * (bands - 1.0), 1.0, fract(depth));
  float tone = (step0 + fracStep) / max(bands - 1.0, 1.0);
  float v = mix(0.15, 1.0, tone);
  return vec4(vec3(v * mask), mask);
}
