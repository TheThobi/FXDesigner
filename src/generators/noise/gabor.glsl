// Gabor noise: sparse convolution of oriented Gabor kernels (Lagae et al.). Controllable
// direction and frequency: fibers, brushed metal, fabric, wood grain, painterly hatching.
vec4 generate(vec2 uv) {
  float scale = max(1.0, floor(u_scale + 0.5));
  vec2 period = vec2(scale);
  vec2 p = uv * scale;
  vec2 i = floor(p);
  vec2 f = fract(p);
  float base = radians(u_angle);
  float sum = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 cell = wrapCell(i + g, period);
      for (int k = 0; k < 16; k++) {
        if (k >= u_impulses) break;
        float fk = float(k);
        vec2 d = g + hash22(cell + fk * 7.13) - f;
        float w = hash12(cell + fk * 3.31) * 2.0 - 1.0;
        float ang = base + (hash12(cell + fk * 5.77) - 0.5) * TAU * u_isotropy;
        float env = exp(-PI * u_bandwidth * u_bandwidth * dot(d, d));
        sum += w * env * cos(TAU * u_frequency * dot(vec2(cos(ang), sin(ang)), d) + u_time * u_speed);
      }
    }
  }
  float v = 0.5 + 0.5 * sum * u_gain / sqrt(float(u_impulses));
  return vec4(vec3(saturate(v)), 1.0);
}
