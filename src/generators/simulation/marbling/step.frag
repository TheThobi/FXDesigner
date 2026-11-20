// Semi-Lagrangian advection of an ink value by a divergence-free, periodic velocity field.
vec2 velocity(vec2 uv, float t) {
  if (u_flow == 1) {
    // Combing: alternating horizontal shear waves (ebru "comb" strokes).
    float k = float(u_scale);
    return vec2(sin(uv.y * TAU * k + t) , 0.3 * sin(uv.x * TAU * 2.0 + t * 0.7));
  }
  if (u_flow == 2) {
    // A few vortices on the torus (wrapped distance).
    vec2 v = vec2(0.0);
    for (int i = 0; i < 6; i++) {
      vec2 c = hash22(vec2(float(i), 3.3));
      vec2 d = uv - c;
      d -= floor(d + 0.5);
      float s = (hash12(vec2(float(i), 9.1)) > 0.5 ? 1.0 : -1.0);
      v += s * vec2(-d.y, d.x) * exp(-dot(d, d) * 40.0) * 6.0;
    }
    return v;
  }
  // Curl noise: v = (dψ/dy, -dψ/dx) of a periodic fBm potential.
  float k = float(u_scale);
  vec2 p = uv * k;
  float e = 0.01;
  float px1 = fbm(p + vec2(e, 0.0), 3, 2.0, 0.5, vec2(k), t, FBM_STANDARD);
  float px0 = fbm(p - vec2(e, 0.0), 3, 2.0, 0.5, vec2(k), t, FBM_STANDARD);
  float py1 = fbm(p + vec2(0.0, e), 3, 2.0, 0.5, vec2(k), t, FBM_STANDARD);
  float py0 = fbm(p - vec2(0.0, e), 3, 2.0, 0.5, vec2(k), t, FBM_STANDARD);
  return vec2(py1 - py0, -(px1 - px0)) / (2.0 * e) * 0.15;
}

void main() {
  float t = u_frame * u_evolution * 0.01;
  vec2 vel = velocity(v_uv, t);
  float v = sampleState(v_uv - vel * u_strength * 0.002).r;
  int brush = brushMode();
  if (brush == 1) v = u_inkValue;
  else if (brush == 2) v = 0.0;
  outColor = vec4(v, 0.0, 0.0, 1.0);
}
