// Painterly flow strokes: line integral convolution (LIC) of smooth noise along a periodic
// curl-noise field. Streaks follow swirling currents like brush strokes.
vec4 generate(vec2 uv) {
  float fs = max(1.0, floor(u_flowScale + 0.5));
  vec2 period = vec2(fs);
  float density = max(1.0, floor(u_density + 0.5));
  float t = loopFlow(u_speed);
  float stepLen = u_length / float(u_steps);
  float acc = 0.0;
  float wsum = 0.0;
  for (int side = 0; side < 2; side++) {
    vec2 q = uv;
    float s = side == 0 ? 1.0 : -1.0;
    for (int i = 0; i < 32; i++) {
      if (i >= u_steps) break;
      vec2 v = curlNoise(q * fs, period, t, 2);
      q += s * v / max(length(v), 1e-5) * stepLen;
      float w = 1.0 - float(i) / float(u_steps);
      acc += valueNoise(fract(q) * density, vec2(density)) * w;
      wsum += w;
    }
  }
  float v = (acc / wsum - 0.5) * u_contrast + 0.5;
  return vec4(vec3(saturate(v)), 1.0);
}
