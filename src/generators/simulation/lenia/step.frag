// Lenia (Bert Chan, 2019): continuous cellular automaton. Each cell convolves its neighbourhood
// with a smooth ring kernel (radius R), then grows by G(U) = 2·exp(−(U−μ)²/2σ²) − 1.
float kernelShell(float r) {
  // Bell-shaped ring peaking at r = 0.5 (r normalized by R).
  float x = (r - 0.5) / 0.15;
  return exp(-0.5 * x * x) * step(r, 1.0);
}

void main() {
  int R = u_radius;
  float sum = 0.0;
  float weight = 0.0;
  for (int y = -16; y <= 16; y++) {
    if (y < -R || y > R) continue;
    for (int x = -16; x <= 16; x++) {
      if (x < -R || x > R) continue;
      float r = length(vec2(float(x), float(y))) / float(R);
      float k = kernelShell(r);
      if (k <= 1e-3) continue;
      sum += neighbor(x, y).r * k;
      weight += k;
    }
  }
  float u = sum / max(weight, 1e-5);
  float d = (u - u_mu) / u_sigma;
  float growth = 2.0 * exp(-0.5 * d * d) - 1.0;
  vec4 s = neighbor(0, 0);
  float a = clamp(s.r + u_dt * growth, 0.0, 1.0);

  int brush = brushMode();
  if (brush == 1) a = max(a, hash12(gl_FragCoord.xy + u_frame));
  else if (brush == 2) a = 0.0;

  float trail = max(a, s.g * (1.0 - u_trailFade * 0.05));
  outColor = vec4(a, trail, 0.0, 1.0);
}
