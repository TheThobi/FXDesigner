// Crystal colored by age: freshly grown tips are bright, old trunks darker; optional field glow.
void main() {
  vec4 s = sampleState(v_uv);
  float age = max(u_frame / 4096.0 - s.b, 0.0) * 4096.0;
  float tip = exp(-age / max(u_tipFade, 1.0));
  float v = s.r * mix(u_trunk, 1.0, tip);
  float field = (1.0 - s.g) * u_fieldGlow * (1.0 - s.r);
  outColor = vec4(vec3(clamp(v + field * 0.6, 0.0, 1.0)), 1.0);
}
