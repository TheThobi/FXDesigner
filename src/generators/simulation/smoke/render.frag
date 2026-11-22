// Density (alpha = density, for transparent sprites), motion vectors (velocity encoded around
// 0.5, for flipbook frame blending), or vorticity.
void main() {
  vec4 s = sampleState(v_uv);
  if (u_view == 1) {
    vec2 v = clamp(s.rg * u_vectorScale * 0.5, -0.5, 0.5);
    outColor = vec4(0.5 + v, 0.5, 1.0);
    return;
  }
  if (u_view == 2) {
    vec2 e = 1.0 / vec2(stateSize());
    float curl = (sampleState(v_uv + vec2(e.x, 0.0)).g - sampleState(v_uv - vec2(e.x, 0.0)).g) -
                 (sampleState(v_uv + vec2(0.0, e.y)).r - sampleState(v_uv - vec2(0.0, e.y)).r);
    outColor = vec4(vec3(saturate(0.5 + curl * 2.0)), 1.0);
    return;
  }
  float d = saturate(s.a);
  d = 1.0 - pow(1.0 - d, u_densityGain);
  outColor = vec4(vec3(d), d);
}
