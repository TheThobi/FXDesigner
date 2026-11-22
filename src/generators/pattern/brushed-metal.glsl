// Brushed metal: thin streaks of stretched noise, linear (seamless) or radial (spun disc).
// Bright = streak.
float brushedStreaks(vec2 p, vec2 period) {
  // Thin streaks: noise stretched along x (rows of 1D noise), several octaves.
  float a = 0.0;
  float amp = 0.5;
  float f = 1.0;
  for (int i = 0; i < 5; i++) {
    a += amp * valueNoise(p * vec2(f, f), period * f);
    amp *= 0.55;
    f *= 2.0;
  }
  return a;
}

vec4 generate(vec2 uv) {
  float v;
  if (u_style == 0) {
    float n = float(u_density);
    v = brushedStreaks(vec2(uv.x * 2.0, uv.y * n), vec2(2.0, n));
  } else {
    vec2 p = centered(uv);
    float r = length(p);
    float a = atan(p.y, p.x) / TAU + 0.5;
    v = brushedStreaks(vec2(a * 3.0, r * float(u_density)), vec2(3.0, 1e4));
  }
  v = mix(0.5, v, u_amount * 2.0);
  return vec4(vec3(saturate(v)), 1.0);
}
