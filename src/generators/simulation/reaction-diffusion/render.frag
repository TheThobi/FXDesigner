// Visualizes the simulation state.
float valueAt(vec2 uv) {
  vec2 s = sampleState(uv).rg;
  if (u_view == 1) return s.x;
  if (u_view == 2) return saturate((s.x - s.y) * u_gain - (u_gain - 1.0) * 0.5);
  return saturate(s.y * u_gain);
}

void main() {
  float v = valueAt(v_uv);
  if (u_view == 3) {
    // Embossed relief lit from u_lightAngle, height = B.
    vec2 texel = 1.0 / vec2(stateSize());
    float hx = sampleState(v_uv + vec2(texel.x, 0.0)).y - sampleState(v_uv - vec2(texel.x, 0.0)).y;
    float hy = sampleState(v_uv + vec2(0.0, texel.y)).y - sampleState(v_uv - vec2(0.0, texel.y)).y;
    vec3 n = normalize(vec3(-hx * u_relief * 20.0, -hy * u_relief * 20.0, 1.0));
    float la = radians(u_lightAngle);
    vec3 l = normalize(vec3(cos(la), sin(la), 0.8));
    float b = saturate(sampleState(v_uv).y * u_gain);
    v = saturate(0.25 + 0.75 * dot(n, l)) * (0.35 + 0.65 * b);
  }
  outColor = vec4(vec3(v), 1.0);
}
