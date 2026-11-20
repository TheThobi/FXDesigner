// Manga speed lines: radial focus lines (re-rolled `rate` times per second) or scrolling streaks.
vec4 generate(vec2 uv) {
  float roll = floor(u_time * u_rate);
  if (u_mode == 0) {
    vec2 p = centered(uv) - u_center;
    float r = length(p);
    float n = float(u_count);
    float a = atan(p.y, p.x) / TAU + 0.5;
    float cell = mod(floor(a * n), n);
    float f = fract(a * n) - 0.5;
    float h1 = hash12(vec2(cell, roll + 1.0));
    float h2 = hash12(vec2(cell, roll + 7.3));
    if (h2 > u_density) return vec4(0.0, 0.0, 0.0, 1.0);
    float start = u_innerRadius * mix(1.0, 0.5 + h1, u_randomness);
    float grow = saturate((r - start) / max(u_taperLength, 1e-3));
    float width = u_width * mix(1.0, 0.3 + 1.4 * h1, u_randomness) * grow;
    float px = (1.5 / u_resolution.x) / max(TAU * r / n, 1e-4);
    float line = 1.0 - smoothstep(width * 0.5, width * 0.5 + px, abs(f));
    return vec4(vec3(line * step(start, r)), 1.0);
  }
  // Parallel streaks scrolling along X (seamless).
  float n = float(u_count);
  float row = floor(uv.y * n);
  float fy = fract(uv.y * n) - 0.5;
  float h1 = hash12(vec2(row, 3.1)), h2 = hash12(vec2(row, 8.7)), h3 = hash12(vec2(row, 5.5));
  if (h3 > u_density) return vec4(0.0, 0.0, 0.0, 1.0);
  float x = fract(uv.x + h1 + u_time * u_speed * (0.5 + h2));
  float len = u_streakLength * mix(1.0, 0.4 + h2, u_randomness);
  float s = x / max(len, 1e-3);
  float thick = u_width * sin(PI * saturate(s));
  float px = 1.5 / u_resolution.y * n;
  float line = (1.0 - smoothstep(thick * 0.5, thick * 0.5 + px, abs(fy))) * step(s, 1.0);
  return vec4(vec3(line), 1.0);
}
