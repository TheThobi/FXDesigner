// Rising ember motes (seamless): small elongated sparks drifting up with sideways sway and
// flicker — the ambient particles of hellish arenas.
vec4 generate(vec2 uv) {
  float n = float(u_cells);
  float t = u_time * u_speed;
  float v = 0.0;
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float scale = n * (1.0 + fl * 0.7);
    vec2 g = (uv - vec2(0.0, t * (0.25 + 0.12 * fl))) * scale;
    vec2 id = floor(g);
    vec2 f = fract(g);
    vec2 cell = mod(id, scale);
    if (hash12(cell + fl * 31.0) > u_density) continue;
    float h = hash12(cell + 2.2 + fl);
    vec2 c = 0.2 + 0.6 * hash22(cell + 5.1 + fl);
    c.x += sin(t * 2.0 + h * TAU) * 0.15 * u_drift;
    vec2 q = f - c;
    q.y /= 1.0 + u_stretch;
    float size = u_size * 0.12 * (0.5 + h) * (1.0 - fl * 0.25);
    float flick = 1.0 - u_flicker * (0.5 + 0.5 * sin(t * 9.0 + h * 40.0));
    v = max(v, exp(-dot(q, q) / max(size * size, 1e-6)) * flick * (1.0 - fl * 0.25));
  }
  return vec4(vec3(saturate(v * 1.4)), 1.0);
}
