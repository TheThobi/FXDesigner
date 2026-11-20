// Fluid pass 2 (repeated): Jacobi iteration of the pressure Poisson equation ∇²p = ∇·v.
// Velocity is untouched here, so the divergence is computed from the neighbours directly.
void main() {
  vec4 l = neighbor(-1, 0), r = neighbor(1, 0), d = neighbor(0, -1), u = neighbor(0, 1);
  vec4 s = neighbor(0, 0);
  float div = 0.5 * ((r.r - l.r) + (u.g - d.g));
  float p = (l.b + r.b + d.b + u.b - div) * 0.25;
  outColor = vec4(s.rg, p, s.a);
}
