// Uniformly random states. State is stored normalized: r = s / 32.
void main() {
  float s = floor(hash12(floor(gl_FragCoord.xy) + 0.5) * float(u_states));
  outColor = vec4(s / 32.0, 0.0, 0.0, 1.0);
}
