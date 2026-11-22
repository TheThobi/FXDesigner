// Anisotropic noise: rows of value noise stretched along one axis (Substance-like): wood
// grain, brushed streaks, rain, fabric. Smoothness blends blocky steps into smooth ramps along
// the rows; Row blend softens the borders between rows. Detail octaves double the rows but
// keep the cells per row, so 1 cell per row is one flat value across the whole width.
// Seamless.
float rowNoise(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  float ux = mix(step(0.5, f.x), s.x, u_smoothness);
  float uy = mix(step(0.5, f.y), s.y, u_rowBlend);
  float a = hash12(wrapCell(i, period));
  float b = hash12(wrapCell(i + vec2(1.0, 0.0), period));
  float c = hash12(wrapCell(i + vec2(0.0, 1.0), period));
  float d = hash12(wrapCell(i + vec2(1.0, 1.0), period));
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
}

vec4 generate(vec2 uv) {
  vec2 p = u_vertical ? uv.yx : uv;
  vec2 period = vec2(float(u_length), float(u_rows));
  float v = 0.0;
  float amp = 1.0;
  float norm = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= u_detail) break;
    v += amp * rowNoise(p * period, period);
    norm += amp;
    period.y *= 2.0;
    amp *= 0.5;
  }
  v /= norm;
  return vec4(vec3(saturate((v - 0.5) * u_contrast + 0.5)), 1.0);
}
