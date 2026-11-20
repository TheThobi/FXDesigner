// Fluid pass 3: subtract the pressure gradient, making the velocity divergence-free.
void main() {
  vec4 l = neighbor(-1, 0), r = neighbor(1, 0), d = neighbor(0, -1), u = neighbor(0, 1);
  vec4 s = neighbor(0, 0);
  vec2 vel = s.rg - 0.5 * vec2(r.b - l.b, u.b - d.b);
  outColor = vec4(vel, s.b * 0.98, s.a);
}
