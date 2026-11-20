// Truchet tiles (seamless): randomly oriented quarter arcs, diagonals or triangles; arcs can
// also fill alternate regions. Tiles slowly flip when animated.
vec4 generate(vec2 uv) {
  float n = float(u_cells);
  vec2 g = uv * n;
  vec2 id = mod(floor(g), n);
  vec2 f = fract(g);
  float h = hash12(id);
  float t = u_time * u_speed;
  float flip = step(0.5, fract(h + floor(t + h * 4.0) * 0.618));
  if (flip > 0.5) f.x = 1.0 - f.x;
  float aa = n * 1.5 / u_resolution.x;
  float w = u_lineWidth * 0.5;
  float d;
  float region = 0.0;
  if (u_mode == 0) {
    float d1 = length(f) - 0.5;
    float d2 = length(f - 1.0) - 0.5;
    d = min(abs(d1), abs(d2));
    region = (d1 < 0.0 || d2 < 0.0) ? 1.0 : 0.0;
  } else if (u_mode == 1) {
    d = abs(f.x - f.y) * 0.7071;
    region = f.x > f.y ? 1.0 : 0.0;
  } else {
    d = 8.0;
    region = f.x + f.y < 1.0 ? 1.0 : 0.0;
  }
  // Checkerboard parity makes filled regions connect into continuous shapes.
  float parity = mod(id.x + id.y, 2.0);
  float fill = u_fill ? abs(region - parity) * 0.55 : 0.0;
  float line = 1.0 - smoothstep(w - aa - u_softness, w + aa, d);
  if (u_mode == 2) line = 0.0;
  return vec4(vec3(max(fill, line)), 1.0);
}
