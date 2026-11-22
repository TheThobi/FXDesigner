// Animal / camo spot patterns (seamless):
//   0 leopard rosettes · 1 cheetah dots · 2 woodland camo · 3 spores
// Output: background 1, spots 0 (colorize with the ramp).
vec2 warp(vec2 p, float period) {
  vec2 q = vec2(fbm(p * 0.8, 3, 2.0, 0.5, vec2(period * 0.8), 0.0, FBM_STANDARD),
                fbm(p * 0.8 + 5.2, 3, 2.0, 0.5, vec2(period * 0.8), 0.0, FBM_STANDARD));
  return p + q * u_irregularity * 0.6;
}

vec4 generate(vec2 uv) {
  float n = float(u_scale);
  vec2 p = uv * n;
  float v = 1.0;
  if (u_mode == 0 || u_mode == 1) {
    vec4 c = voronoiNearest(warp(p, n), vec2(n), 0.9);
    float r = length(c.xy);
    float size = u_size * 0.45 * mix(0.7, 1.15, c.w);
    float aa = fwidth(r) * 1.2;
    if (u_mode == 0) {
      // Rosette: a broken dark ring around a slightly darker centre.
      float ring = abs(r - size) - u_ringWidth * size * 0.5;
      float a = atan(c.y, c.x) / TAU + 0.5;
      float gaps = valueNoise(vec2(a * 5.0 + c.w * 13.0, 0.0), vec2(5.0, 1e4));
      float broken = smoothstep(u_coverage - 0.1, u_coverage + 0.1, gaps);
      v = mix(1.0, 0.0, (1.0 - smoothstep(-aa, aa, ring)) * (1.0 - broken));
      v = min(v, mix(1.0, 0.72, 1.0 - smoothstep(size * 0.7 - aa, size * 0.7 + aa, r)));
    } else {
      v = smoothstep(size - aa, size + aa, r);
    }
  } else if (u_mode == 2) {
    // Woodland camo: thresholded fBm layers stacked into flat tones.
    float levels = float(u_levels);
    for (int i = 0; i < 4; i++) {
      if (i >= u_levels) break;
      float fi = float(i);
      float f = fbm(p * 0.7 + fi * 3.7, 4, 2.0, 0.5, vec2(n * 0.7), 0.0, FBM_STANDARD);
      float th = mix(0.25, -0.15, u_size) + fi * 0.05;
      float k = f * (0.8 + u_irregularity);
      float aa = fwidth(k);
      v = mix(v, 1.0 - (fi + 1.0) / levels, smoothstep(th - aa, th + aa, k));
    }
  } else {
    // Spores: scattered irregular blobs of varied size, on two scales.
    for (int layer = 0; layer < 2; layer++) {
      float s = 1.0 + float(layer);
      vec3 c = voronoi(warp(p * s, n * s), vec2(n * s), 1.0, 0.0, METRIC_EUCLIDEAN);
      float size = u_size * 0.3 * mix(0.3, 1.0, c.z) / s;
      float aa = fwidth(c.x);
      if (c.z < u_coverage) v = min(v, smoothstep(size - aa, size + aa, c.x));
    }
  }
  return vec4(vec3(v), 1.0);
}
