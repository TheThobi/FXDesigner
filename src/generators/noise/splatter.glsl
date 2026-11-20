// Paint splats: blobs with rough edges and satellite droplets, per-splat tone. Seamless.
vec4 generate(vec2 uv) {
  float n = float(u_cells);
  vec2 g = uv * n;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float aa = n * 1.5 / u_resolution.x;
  float v = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 cell = mod(id + o, n);
      if (hash12(cell) > u_density) continue;
      vec2 c = o + 0.2 + 0.6 * hash22(cell + 1.3);
      float r = u_size * (0.5 + 0.5 * hash12(cell + 2.1));
      vec2 d = f - c;
      float edge = r * (1.0 + u_roughness * 0.5 * polarNoise(d, 7.0, hash12(cell + 5.5) * 10.0, 3));
      float blob = 1.0 - smoothstep(edge - aa, edge + aa, length(d));
      for (int k = 0; k < 8; k++) {
        if (k >= u_droplets) break;
        float fk = float(k);
        float a = hash12(cell + fk * 1.7) * TAU;
        vec2 pc = c + vec2(cos(a), sin(a)) * r * (1.2 + hash12(cell + fk * 2.9) * 1.2);
        float dr = r * 0.15 * (0.4 + hash12(cell + fk * 4.3));
        blob = max(blob, 1.0 - smoothstep(dr - aa, dr + aa, length(f - pc)));
      }
      v = max(v, blob * mix(1.0, 0.4 + 0.6 * hash12(cell + 9.9), u_toneVariation));
    }
  }
  return vec4(vec3(v), 1.0);
}
