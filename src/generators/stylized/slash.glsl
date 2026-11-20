// Anime sword-slash crescent: sharp outer edge fading inward; thin tail -> fat body -> sharp tip.
vec4 generate(vec2 uv) {
  vec2 p = rotate2d(centered(uv), -radians(u_rotation));
  float r = length(p);
  float arc = radians(u_arc);
  float t = (atan(p.y, p.x) + arc * 0.5) / max(arc, 1e-3); // 0 = tail, 1 = head
  if (t < 0.0 || t > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);

  float profile = pow(t, u_taper) * (1.0 - smoothstep(0.82, 1.0, t));
  float w = max(u_thickness * profile, 1e-4);
  float d = (u_radius - r) / w; // 0 at the outer edge, 1 at the inner edge
  float aa = min((2.0 / u_resolution.x) / w, 0.5);
  float body = smoothstep(-aa, 0.0, d) * (1.0 - smoothstep(1.0 - aa, 1.0, d));

  float fade = pow(saturate(1.0 - d), u_falloff);
  float n = 0.5 + 0.5 * gradientNoise(vec2(d * u_streaks, t * 3.0 - u_time * u_speed), vec2(0.0), 0.0);
  float v = body * fade * mix(1.0, n, u_streakAmount) * mix(0.4, 1.0, t);
  v = max(v, body * (1.0 - smoothstep(0.0, 0.12, d)) * u_edgeHighlight);
  return vec4(vec3(saturate(v)), 1.0);
}
