// Paint mask start: empty, filled, or soft noise blobs. State: r = paint amount.
void main() {
  vec2 uv = gl_FragCoord.xy / u_gridSize;
  float v = 0.0;
  if (u_start == 1) v = 1.0;
  else if (u_start == 2)
    v = smoothstep(0.1, 0.4, fbm(uv * 3.0, 4, 2.0, 0.5, vec2(3.0), 0.0, FBM_STANDARD));
  outColor = vec4(v, 0.0, 0.0, 1.0);
}
