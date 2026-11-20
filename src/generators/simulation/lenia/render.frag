// Organism density, optionally with its fading trail and an edge highlight.
void main() {
  vec4 s = sampleState(v_uv);
  float a = s.r;
  float v = a;
  if (u_view == 1) v = max(a, s.g * 0.45);
  else if (u_view == 2) {
    vec2 e = 1.0 / vec2(stateSize());
    float gx = sampleState(v_uv + vec2(e.x, 0.0)).r - sampleState(v_uv - vec2(e.x, 0.0)).r;
    float gy = sampleState(v_uv + vec2(0.0, e.y)).r - sampleState(v_uv - vec2(0.0, e.y)).r;
    v = clamp(length(vec2(gx, gy)) * 3.0 + a * 0.35, 0.0, 1.0);
  }
  outColor = vec4(vec3(pow(v, 1.0 / u_gamma)), 1.0);
}
