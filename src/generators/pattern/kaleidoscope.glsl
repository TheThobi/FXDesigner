// Kaleidoscope: mirrors a source pattern into N symmetric wedges around the center.
float sourcePattern(vec2 q, float t) {
  if (u_pattern == 0) return smoothstep(-0.35, 0.35, fbm(q * u_zoom + vec2(t * 0.3, 0.0), 5));
  if (u_pattern == 1) {
    vec3 v = voronoi(q * u_zoom * 1.5 + vec2(0.0, t * 0.2), vec2(0.0), 1.0, t, 0);
    return smoothstep(0.0, 0.08, v.y - v.x);
  }
  return 0.5 + 0.5 * sin(length(q) * u_zoom * 12.0 - t * 2.0 + fbm(q * 3.0, 3) * 3.0);
}

vec4 generate(vec2 uv) {
  vec2 p = rotate2d(centered(uv), radians(u_rotation));
  float t = u_time * u_speed;
  float r = length(p);
  float a = atan(p.y, p.x) + u_twist * r;
  float wedge = TAU / float(u_segments);
  a = mod(a, wedge);
  a = abs(a - wedge * 0.5); // mirror inside the wedge
  vec2 q = vec2(cos(a), sin(a)) * r;
  float v = sourcePattern(q, t);
  float vignette = 1.0 - smoothstep(0.9, 1.0, r) * u_circular;
  return vec4(vec3(saturate(v * vignette)), 1.0);
}
