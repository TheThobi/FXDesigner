// Fluid pass 1: semi-Lagrangian advection of velocity and dye, plus forces (stirring, plume,
// brush). Stable for any time step (Stam 1999).
void main() {
  vec2 size = vec2(stateSize());
  if (solidAt(0, 0)) {
    // Inside an obstacle: still fluid, no ink.
    outColor = vec4(0.0, 0.0, neighbor(0, 0).b, 0.0);
    outColor2 = vec4(0.0);
    return;
  }
  vec4 s = neighbor(0, 0);
  vec2 back = v_uv - s.rg * u_dtScale / size;
  vec4 a = sampleState(back);
  vec2 vel = a.rg * (1.0 - u_viscosity * 0.02);
  float fade = 1.0 - u_dissipation * 0.002;
  float dye = a.a * fade;
  // Ink color, premultiplied by the dye: advected and faded exactly like it.
  vec3 ink = sampleState2(back).rgb * fade;
  vec3 brushInk = u_brushInk == 0 ? u_inkA : u_brushInk == 1 ? u_inkB : u_inkC;

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
    if (source > dye) {
      ink = mix(ink, u_inkA, (source - dye) / max(1.0 - dye, 1e-4));
      dye = source;
    }
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
      ink = mix(ink, brushInk, f * 0.5);
    } else {
      dye *= 1.0 - f;
      ink *= 1.0 - f;
    }
  }
  float speed = length(vel);
  if (speed > 4.0) vel *= 4.0 / speed; // keep the solver tame
  outColor = vec4(vel, s.b, clamp(dye, 0.0, 1.0));
  outColor2 = vec4(clamp(ink, 0.0, 1.0), 0.0);
}
