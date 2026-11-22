// Weave: weft (horizontal) and warp (vertical) threads crossing over and under each other,
// as a height map. Plain, twill or basket order; rounded threads with fibers. Seamless (the
// thread count is rounded so the over/under order repeats within the tile).
float threadProfile(float d, float halfWidth) {
  float x = saturate(d / max(halfWidth, 1e-3));
  return sqrt(max(1.0 - x * x, 0.0));
}

bool weftOnTop(vec2 cell) {
  if (u_pattern == 0) return mod(cell.x + cell.y, 2.0) < 0.5;
  if (u_pattern == 1) return mod(cell.x - cell.y, 4.0) < 1.5;
  return mod(floor(cell.x / 2.0) + floor(cell.y / 2.0), 2.0) < 0.5;
}

// Fine lengthwise fibers: streaks across the thread.
float fibers(float across, float along, float salt) {
  float f = valueNoise(vec2(across * 9.0 + salt, along * 0.6), vec2(0.0));
  return mix(1.0, 0.55 + 0.45 * f, u_fibers);
}

vec4 generate(vec2 uv) {
  float repeat = u_pattern == 1 ? 4.0 : u_pattern == 2 ? 2.0 : 1.0;
  float n = max(repeat, ceil(float(u_threads) / repeat) * repeat);
  vec2 g = uv * n;
  vec2 cell = floor(g);
  vec2 f = fract(g);
  vec2 key = mod(cell, n);
  // Per-thread width jitter (weft threads by row, warp threads by column).
  float wWeft = u_width * mix(1.0 - u_irregularity, 1.0, hash12(vec2(13.3, key.y)));
  float wWarp = u_width * mix(1.0 - u_irregularity, 1.0, hash12(vec2(key.x, 7.1)));
  bool weftTop = weftOnTop(key);
  // Threads rise where they pass over and dip where they go under.
  float bumpX = sin(PI * f.x);
  float bumpY = sin(PI * f.y);
  float weft = threadProfile(abs(f.y - 0.5), wWeft * 0.5);
  float warp = threadProfile(abs(f.x - 0.5), wWarp * 0.5);
  weft *= weftTop ? 0.62 + 0.38 * bumpX : 0.62 - 0.3 * bumpX;
  warp *= weftTop ? 0.62 - 0.3 * bumpY : 0.62 + 0.38 * bumpY;
  weft *= fibers(f.y + key.y, g.x, 0.0);
  warp *= fibers(f.x + key.x, g.y, 31.7);
  return vec4(vec3(saturate(max(weft, warp))), 1.0);
}
