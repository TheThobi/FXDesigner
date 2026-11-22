// Smoke pass 2: semi-Lagrangian advection of velocity and density (Stam 1999), with
// dissipation. Stable for any time step.
void main() {
  vec2 size = vec2(stateSize());
  vec4 s = neighbor(0, 0);
  vec4 a = sampleState(v_uv - s.rg * u_dtScale / size);
  vec2 vel = a.rg * (1.0 - u_drag * 0.01);
  float dens = a.a * (1.0 - u_dissipation * 0.003);
  float speed = length(vel);
  if (speed > 4.0) vel *= 4.0 / speed; // keep the solver tame
  outColor = vec4(vel, s.b, clamp(dens, 0.0, 1.0));
}
