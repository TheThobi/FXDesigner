// Fluid pass 3: subtract the pressure gradient, making the velocity divergence-free.
void main() {
  vec4 l = neighbor(-1, 0), r = neighbor(1, 0), d = neighbor(0, -1), u = neighbor(0, 1);
  vec4 s = neighbor(0, 0);
  if (solidAt(-1, 0)) l.b = s.b;
  if (solidAt(1, 0)) r.b = s.b;
  if (solidAt(0, -1)) d.b = s.b;
  if (solidAt(0, 1)) u.b = s.b;
  vec2 vel = s.rg - 0.5 * vec2(r.b - l.b, u.b - d.b);
  if (solidAt(0, 0)) vel = vec2(0.0);
  outColor = vec4(vel, s.b * 0.98, s.a);
#ifdef SIM_EXTRA_STATE
  outColor2 = neighbor2(0, 0);
#endif
}
