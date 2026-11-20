// Expanding concentric rings (water ripples, shockwaves). Loops seamlessly in time.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float r = length(p);
  float t = u_time * u_speed;
  float wobble = u_distortion > 0.0 ? polarNoise(p, 8.0, t * 0.5 + r * 2.0, 3) * u_distortion * 0.05 : 0.0;
  float aa = 2.0 / u_resolution.x;
  float v = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= u_rings) break;
    float phase = fract(t + float(i) / float(u_rings));
    float width = u_thickness * mix(1.0, 0.35, phase);
    float d = abs(r + wobble - phase * u_maxRadius);
    float ring = 1.0 - smoothstep(width * 0.5, width * 0.5 + u_softness * width + aa, d);
    v = max(v, ring * pow(1.0 - phase, u_fade));
  }
  return vec4(vec3(v), 1.0);
}
