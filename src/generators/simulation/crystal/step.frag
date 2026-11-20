// Crystal pass 2: growth. Dielectric breakdown model (Niemeyer, Pietronero & Wiesmann 1984), a
// GPU-friendly cousin of diffusion-limited aggregation: empty cells touching the crystal freeze
// with a probability ∝ φ^η. η ≈ 1 gives DLA-like dendrites, higher η thinner lightning-like
// branches, lower η bushy coral.
void main() {
  vec4 s = neighbor(0, 0);
  if (s.r > 0.5) {
    outColor = vec4(1.0, 0.0, s.b, 1.0);
    return;
  }
  float touching = max(max(neighbor(-1, 0).r, neighbor(1, 0).r), max(neighbor(0, -1).r, neighbor(0, 1).r));
  if (u_diagonal) {
    touching = max(touching, max(max(neighbor(-1, -1).r, neighbor(1, -1).r),
                                 max(neighbor(-1, 1).r, neighbor(1, 1).r)));
  }
  float crystal = 0.0;
  float birth = s.b;
  if (touching > 0.5) {
    // φ near the crystal is small: rescale so the strongest tips grow at `growthRate`.
    float p = pow(clamp(s.g * 4.0, 0.0, 1.0), u_eta) * u_growthRate * 0.1;
    if (hash12(gl_FragCoord.xy * 1.37 + fract(u_frame * 0.618) * 97.0) < p) {
      crystal = 1.0;
      birth = u_frame / 4096.0;
    }
  }
  if (brushMode() == 1) {
    crystal = 1.0;
    birth = u_frame / 4096.0;
  }
  outColor = vec4(crystal, crystal > 0.5 ? 0.0 : s.g, birth, 1.0);
}
