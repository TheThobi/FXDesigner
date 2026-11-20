// Spark streaks: tapered streaks with a hot head. One centered streak, or a radial burst
// whose sparks fly outward over time.
float streak(vec2 q, float len, float width) {
  float t = (q.x + len * 0.5) / len; // 0 = tail, 1 = head
  if (t < 0.0 || t > 1.0) return 0.0;
  float w = max(width * mix(0.12, 1.0, pow(t, u_taper)), 1e-4);
  float across = exp(-(q.y * q.y) / (w * w));
  return across * mix(0.25, 1.0, t) * (1.0 - smoothstep(0.96, 1.0, t));
}

vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float v = 0.0;
  if (u_count <= 1) {
    v = streak(rotate2d(p, -radians(u_angle)), u_length, u_width);
  } else {
    for (int i = 0; i < 32; i++) {
      if (i >= u_count) break;
      float fi = float(i);
      float a = fi / float(u_count) * TAU + (hash12(vec2(fi, 3.0)) - 0.5) * u_spread;
      float len = u_length * 0.5 * mix(1.0, 0.4 + 0.6 * hash12(vec2(fi, 7.0)), u_randomness);
      float phase = fract(u_time * u_speed + hash12(vec2(fi, 9.0)));
      float dist = u_burstRadius + len * 0.5 + phase * max(0.95 - u_burstRadius - len, 0.0);
      vec2 dir = vec2(cos(a), sin(a));
      vec2 q = vec2(dot(p, dir) - dist, dot(p, vec2(-dir.y, dir.x)));
      float fade = u_speed > 0.0 ? 1.0 - phase : 1.0;
      v = max(v, streak(q, len, u_width * 0.7) * fade);
    }
  }
  return vec4(vec3(saturate(v * u_intensity)), 1.0);
}
