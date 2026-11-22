// Anime fire: a flame "heat" field (silhouette × upward-scrolling noise, domain-warped so the
// tongues curl into hooks) cut into flat tones — dark outline band, body, bright core.
float flameField(vec2 p, float t) {
  float y = p.y / (1.7 * u_height);
  float w = u_width * mix(1.0, 0.25, saturate(y));
  // Rounded bulb at the base, tapering body above.
  float r = length(vec2(p.x / max(w, 1e-3), min(y, 0.0) / 0.12));
  float silhouette = 1.0 - smoothstep(0.0, 1.0, r);
  vec2 q = p * vec2(1.8, 1.0) * float(u_tongues) / 4.0;
  q.x += sin(q.y * 2.2 - t * 2.4) * u_hook * 0.45 * saturate(y + 0.2);
  q.y -= t * 1.6;
  float n = saturate(0.5 + 1.6 * fbm(q, 4));
  return silhouette * (1.2 - y) - (1.0 - n) * 1.3 * saturate(y + 0.25) - 0.1;
}

vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  // Base raised above the bottom edge (offset moves the whole flame vertically).
  p.y += 0.55 - u_offset;
  float t = u_time * u_speed;
  float f = flameField(p, t);
  // Burn the field off near the top / bottom edges: nothing may touch them, or it would
  // wrap to the opposite side when the texture repeats (flipbooks, tiled sampling).
  f -= 1.5 * (smoothstep(0.88, 0.99, uv.y) + smoothstep(0.08, 0.01, uv.y));
  float aa = clamp(fwidth(f) * 1.2, 1e-4, 0.03);
  float mask = smoothstep(-aa, aa, f);
  float body = smoothstep(u_outline - aa, u_outline + aa, f);
  float core = smoothstep(u_core * 0.6 - aa, u_core * 0.6 + aa, f);
  float v = mix(0.18, mix(0.6, 1.0, core), body);
  return vec4(vec3(v * mask), mask);
}
