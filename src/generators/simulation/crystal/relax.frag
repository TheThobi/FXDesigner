// Crystal pass 1 (repeated): Jacobi relaxation of the potential φ (Laplace equation), φ = 0 on
// the crystal and weakly pulled to 1 everywhere else (sets how far the crystal "screens").
void main() {
  vec4 s = neighbor(0, 0);
  if (s.r > 0.5) {
    outColor = vec4(1.0, 0.0, s.b, 1.0);
    return;
  }
  float phi = 0.25 * (neighbor(-1, 0).g + neighbor(1, 0).g + neighbor(0, -1).g + neighbor(0, 1).g);
  phi = mix(phi, 1.0, u_farField * 0.002);
  outColor = vec4(0.0, phi, s.b, 1.0);
}
