// Fluid pass 1: semi-Lagrangian advection of velocity and dye, plus forces (stirring, plume,
// brush). Stable for any time step (Stam 1999).
void main() {
  vec2 size = vec2(stateSize());
  vec4 s = neighbor(0, 0);
  vec2 back = v_uv - s.rg * u_dtScale / size;
  vec4 a = sampleState(back);
  vec2 vel = a.rg * (1.0 - u_viscosity * 0.02);
  float dye = a.a * (1.0 - u_dissipation * 0.002);

  float t = u_frame * 0.004 * u_stirSpeed;
  if (u_force == 0) {
    // Slowly evolving curl-noise stirring: divergence-free, keeps the ink swirling.
    vec2 c = curlNoise(v_uv * u_stirScale, vec2(u_stirScale), t, 2);
    vel += c * u_stirStrength * 0.02;
  } else if (u_force == 1) {
    // Rising plume from the bottom center, with buoyancy from the dye.
    vec2 d = v_uv - vec2(0.5, 0.08);
    d.x -= round(d.x);
    float source = exp(-dot(d, d) / 0.002);
    vel.y += (source * 0.6 + dye * 0.02) * u_stirStrength;
    dye = max(dye, source);
  } else if (u_force == 2) {
    // Two opposing jets (Kelvin–Helmholtz rolls).
    float band = smoothstep(0.08, 0.0, abs(v_uv.y - 0.5));
    vel.x += sign(v_uv.y - 0.5) * u_stirStrength * 0.02 * (1.0 - band);
  }

  if (u_brush.w > 0.5) {
    vec2 d = brushDelta(v_uv, u_brush.xy);
    float f = exp(-dot(d, d) / (u_brush.z * u_brush.z));
    if (u_brush.w < 1.5) {
      vel += u_brushDir * size * f * 0.5;
      dye = mix(dye, 1.0, f * 0.5);
    } else {
      dye *= 1.0 - f;
    }
  }
  float speed = length(vel);
  if (speed > 4.0) vel *= 4.0 / speed; // keep the solver tame
  outColor = vec4(vel, s.b, clamp(dye, 0.0, 1.0));
}
