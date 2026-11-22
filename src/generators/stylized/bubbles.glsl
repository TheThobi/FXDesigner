// Field of rising bubbles (seamless): thin bright rims, faint fill, crescent highlight.
// Alpha = coverage, so the bubbles composite over anything (no forced black background).
vec4 generate(vec2 uv) {
  float n = float(u_cells);
  float t = u_time * u_speed;
  float v = 0.0;
  float aa = n * 2.0 / u_resolution.x;
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    vec2 g = (uv + vec2(0.0, -t * (0.2 + 0.1 * fl))) * n * (1.0 + fl * 0.6);
    float period = n * (1.0 + fl * 0.6);
    vec2 id = floor(g);
    vec2 f = fract(g);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 o = vec2(float(x), float(y));
        vec2 cell = mod(id + o, period);
        if (hash12(cell + fl * 13.0) > u_density) continue;
        float wob = sin(t * 2.0 + hash12(cell) * TAU) * 0.08;
        vec2 c = o + 0.25 + 0.5 * hash22(cell + 1.3 + fl) + vec2(wob, 0.0);
        float size = 0.45 * u_size * mix(1.0, 0.35 + 0.65 * hash12(cell + 7.1), u_sizeVariation);
        float r = length(f - c) / max(size, 1e-3);
        if (r > 1.2) continue;
        float rim = smoothstep(1.0 - u_rim - aa, 1.0 - aa, r) * (1.0 - smoothstep(1.0 - aa, 1.0 + aa, r));
        float fill = (1.0 - smoothstep(1.0 - aa, 1.0, r)) * 0.12;
        vec2 hp = (f - c) / size - vec2(-0.35, 0.35);
        float hl = (1.0 - smoothstep(0.12, 0.2, length(hp * vec2(1.0, 1.6)))) * u_highlight;
        v = max(v, max(rim + fill, hl) * (1.0 - fl * 0.35));
      }
    }
  }
  // Transparent background: alpha follows the rims / fill / highlights.
  v = saturate(v);
  return vec4(vec3(v), v);
}
