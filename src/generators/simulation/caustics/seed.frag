// Still water with a few initial drops. State: r = height, g = vertical velocity.
void main() {
  vec2 uv = gl_FragCoord.xy / u_gridSize;
  float h = 0.0;
  for (int i = 0; i < 6; i++) {
    vec2 c = hash22(vec2(float(i) * 7.31, u_seed * 0.173 + 3.7));
    vec2 d = wrapDelta(uv, c);
    h -= u_dropStrength * exp(-dot(d, d) / max(u_dropSize * u_dropSize, 1e-6));
  }
  outColor = vec4(h, 0.0, 0.0, 1.0);
}
