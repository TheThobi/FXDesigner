// Scattered 4-point twinkling stars (astroid shape) on a seamless jittered grid.
float sparkleShape(vec2 q, float size) {
  q = abs(q) / max(size, 1e-4);
  return sqrt(q.x) + sqrt(q.y); // < 1 inside
}

vec4 generate(vec2 uv) {
  float n = float(u_cells);
  vec2 g = uv * n;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float aa = n * 2.0 / u_resolution.x;
  float v = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 cell = mod(id + o, n);
      if (hash12(cell) > u_density) continue;
      vec2 pos = o + 0.2 + 0.6 * hash22(cell + 1.7);
      float phase = hash12(cell + 9.2);
      float tw = mix(1.0, pow(0.5 + 0.5 * sin((u_time * u_speed + phase) * TAU), 3.0), u_twinkle);
      float size = u_size * mix(1.0, 0.3 + 0.7 * hash12(cell + 4.4), u_sizeVariation) * tw;
      vec2 q = rotate2d(f - pos, radians(u_rotation) + u_randomRotation * phase * TAU);
      float star = 1.0 - smoothstep(1.0 - aa / max(size, 1e-3), 1.0, sparkleShape(q, size));
      float glow = u_glow * exp(-length(q) / max(size, 1e-3) * 4.0) * tw;
      v = max(v, star + glow);
    }
  }
  return vec4(vec3(saturate(v)), 1.0);
}
