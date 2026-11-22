// Smooth grayscale masks for shader work (seamless unless noted):
//   0 radial grid · 1 diamond grid · 2 sine stripes · 3 swirl (centered, not tiling)
//   4 ring cells · 5 vertical glow with streaks
vec4 generate(vec2 uv) {
  float n = float(u_cells);
  float t = u_time * u_speed;
  vec2 g = uv * n;
  if (u_offsetRows && mod(floor(g.y), 2.0) > 0.5) g.x += 0.5;
  vec2 f = fract(g) - 0.5;
  float v;
  if (u_mode == 0) {
    v = saturate(1.0 - length(f) * 2.0);
  } else if (u_mode == 1) {
    v = saturate(1.0 - (abs(f.x) + abs(f.y)) * 2.0);
  } else if (u_mode == 2) {
    // Lattice directions only, so every orientation tiles.
    vec2 dirs[4] = vec2[4](vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(1.0, 1.0), vec2(1.0, -1.0));
    float phase = dot(uv * n, dirs[u_direction]) - t;
    v = 0.5 + 0.5 * cos(TAU * phase);
  } else if (u_mode == 3) {
    vec2 p = centered(uv);
    float r = length(p);
    float a = atan(p.y, p.x);
    v = 0.5 + 0.5 * sin(float(u_arms) * a + u_twist * TAU * r - t * TAU);
    v *= saturate(1.0 - r);
  } else if (u_mode == 4) {
    float d = length(f) * 2.0;
    v = (0.5 + 0.5 * cos(TAU * (d * float(u_rings) - t))) * saturate(1.0 - d);
  } else {
    float y = fract(uv.y);
    float s = valueNoise(vec2(uv.x * u_streaks, t * 0.5), vec2(u_streaks, 1e4));
    v = pow(1.0 - y, 1.5) * mix(1.0, 0.3 + 1.2 * s, u_streakAmount);
    v *= smoothstep(0.0, 0.04, y); // fade before the edge: no wrap-around bleed
  }
  v = pow(saturate(v), u_sharpness);
  return vec4(vec3(v), 1.0);
}
