// State index -> [0, 1]. "Smooth" averages the 3x3 neighbourhood for softer bands.
void main() {
  vec2 cell = v_uv * vec2(stateSize());
  float n = float(u_states - 1);
  float v;
  if (u_smooth) {
    v = 0.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++)
        v += floor(stateAt(ivec2(floor(cell)) + ivec2(x, y)).r * 32.0 + 0.5);
    v /= 9.0 * n;
  } else {
    v = floor(stateAt(ivec2(floor(cell))).r * 32.0 + 0.5) / n;
  }
  outColor = vec4(vec3(saturate(v)), 1.0);
}
