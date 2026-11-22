// Scratches: straight seamless scratch segments in two scales of cells. Bright = scratch.
float scratchLayer(vec2 uv, float n, float salt) {
  vec2 g = uv * n;
  vec2 i = floor(g);
  float px = n / u_resolution.x;
  float v = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = i + vec2(float(x), float(y));
      vec2 key = mod(cell, n) + salt;
      for (int k = 0; k < 2; k++) {
        vec2 kk = key + float(k) * 19.7;
        if (hash12(kk + 3.3) > u_amount) continue;
        vec2 c = cell + hash22(kk);
        float ang = radians(u_angle) + (hash12(kk + 5.1) - 0.5) * PI * u_spread;
        vec2 dir = vec2(cos(ang), sin(ang));
        float len = mix(0.3, 1.6, hash12(kk + 8.4)) * u_length;
        float d = sdSegment(g, c - dir * len * 0.5, c + dir * len * 0.5);
        float w = u_width * mix(0.4, 1.0, hash12(kk + 1.9)) * 0.06;
        float line = 1.0 - smoothstep(w, w + px, d);
        v = max(v, line * mix(0.35, 1.0, hash12(kk + 6.6)));
      }
    }
  }
  return v;
}

vec4 generate(vec2 uv) {
  float n = float(u_density) * 0.25;
  float v = max(scratchLayer(uv, max(1.0, floor(n)), 0.0),
                scratchLayer(uv, max(1.0, floor(n * 2.0)), 11.0) * 0.6);
  return vec4(vec3(saturate(v)), 1.0);
}
