// Views: height, lit relief with water, water, erosion / deposit.
void main() {
  vec4 s = sampleState(v_uv);
  float v;
  if (u_view == 0) {
    v = s.r;
  } else if (u_view == 1) {
    vec2 texel = 1.0 / vec2(stateSize());
    float hx = sampleState(v_uv + vec2(texel.x, 0.0)).r - sampleState(v_uv - vec2(texel.x, 0.0)).r;
    float hy = sampleState(v_uv + vec2(0.0, texel.y)).r - sampleState(v_uv - vec2(0.0, texel.y)).r;
    vec3 n = normalize(vec3(-hx * u_relief * 0.5, -hy * u_relief * 0.5, 1.0));
    vec3 l = normalize(vec3(-0.6, 0.6, 0.7));
    v = saturate(0.15 + 0.85 * dot(n, l));
    v = mix(v, v * 0.35, saturate(s.g * 400.0));
  } else if (u_view == 2) {
    v = saturate(s.g * 200.0);
  } else {
    // 0.5 = unchanged, darker = eroded, brighter = deposited.
    v = saturate(0.5 + (s.r - s.a) * 8.0);
  }
  outColor = vec4(vec3(v), 1.0);
}
