// White paint on black, optionally blurred for soft emitters / masks.
void main() {
  float v = sampleState(v_uv).r;
  if (u_softness > 0.0) {
    float s = u_softness * 0.02;
    float sum = v;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * TAU / 8.0;
      sum += sampleState(v_uv + vec2(cos(a), sin(a)) * s).r;
    }
    v = sum / 9.0;
  }
  outColor = vec4(vec3(v), 1.0);
}
