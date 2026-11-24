// Interference of circular waves from random sources (wrapped distances: seamless).
vec4 generate(vec2 uv) {
  float sum = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= u_sources) break;
    float fi = float(i);
    vec2 c = hash22(vec2(fi, 1.7));
    float d = length(wrapDelta(uv, c));
    float k = u_frequency * TAU * mix(1.0, 0.6 + 0.8 * hash12(vec2(fi, 8.8)), u_variation);
    float phase = hash12(vec2(fi, 4.2)) * TAU;
    sum += cos(d * k - loopFlow(u_speed * TAU) + phase) * exp(-d * u_damping);
  }
  float v = 0.5 + 0.5 * sum / sqrt(float(u_sources));
  return vec4(vec3(pow(saturate(v), u_sharpness)), 1.0);
}
