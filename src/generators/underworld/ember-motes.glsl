// Rising ember motes (seamless): small elongated sparks drifting up with sideways sway and
// flicker — the ambient particles of hellish arenas.
vec4 generate(vec2 uv) {
  float n = float(u_cells);
  float t = u_time * u_speed;
  float v = 0.0;
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float scale = floor(n * (1.0 + fl * 0.7) + 0.5);
    vec2 g = (uv - vec2(0.0, t * (0.25 + 0.12 * fl))) * scale;
    float strength = 1.0 - fl * 0.25;
    float sway = 0.15 * u_drift;
    vec2 stretch = vec2(1.0, 1.0 + u_stretch);
    // Check every cell whose spark could reach this pixel. Long sparks cross multiple rows.
    vec2 reach = u_size * 0.54 * strength * stretch;
    vec2 centerMin = vec2(0.2 - sway, 0.2);
    vec2 centerMax = vec2(0.8 + sway, 0.8);
    ivec2 first = ivec2(ceil(g - reach - centerMax));
    ivec2 last = ivec2(floor(g + reach - centerMin));
    ivec2 count = min(ivec2(int(scale)), last - first + 1);
    for (int y = 0; y < count.y; y++) {
      for (int x = 0; x < count.x; x++) {
        vec2 cell = wrapCell(vec2(first + ivec2(x, y)), vec2(scale));
        if (hash12(cell + fl * 31.0) > u_density) continue;
        float h = hash12(cell + 2.2 + fl);
        vec2 c = cell + 0.2 + 0.6 * hash22(cell + 5.1 + fl);
        c.x += sin(t * 2.0 + h * TAU) * sway;
        vec2 q = (mod(g - c + scale * 0.5, scale) - scale * 0.5) / stretch;
        float size = u_size * 0.12 * (0.5 + h) * strength;
        float d = dot(q, q) / max(size * size, 1e-6);
        if (d >= 9.0) continue;
        float flick = 1.0 - u_flicker * (0.5 + 0.5 * sin(t * 9.0 + h * 40.0));
        v = max(v, exp(-d) * (1.0 - smoothstep(6.25, 9.0, d)) * flick * strength);
      }
    }
  }
  return vec4(vec3(saturate(v * 1.4)), 1.0);
}
