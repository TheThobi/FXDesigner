// Stylized shockwave: an expanding ring with a sharp front, plus debris chunks thrown outward.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float t = u_speed > 0.0 ? fract(u_time * u_speed) : u_progress;
  float r = length(p);
  float a = atan(p.y, p.x);
  float wobble = u_distortion * 0.06 * polarNoise(p, 8.0, t * 3.0, 3);
  float front = mix(0.05, 0.95, pow(t, 0.6)) + wobble;
  float w = u_ringWidth * (1.0 - t * 0.5);
  float x = (front - r) / max(w, 1e-3); // 0 at the front, > 0 behind it
  float ring = x > 0.0 ? exp(-x * 1.6) : exp(-x * x * 40.0);
  ring *= 1.0 - t;
  float debris = 0.0;
  for (int i = 0; i < 48; i++) {
    if (i >= u_debris) break;
    float fi = float(i);
    float h = hash12(vec2(fi, 3.3));
    float da = fi / float(u_debris) * TAU + h;
    vec2 dir = vec2(cos(da), sin(da));
    float dist = front * (0.7 + 0.5 * hash12(vec2(fi, 8.1)));
    vec2 q = rotate2d(p - dir * dist, h * TAU + t * 6.0 * (h - 0.5));
    float size = u_debrisSize * (0.4 + 0.8 * hash12(vec2(fi, 5.5))) * (1.0 - t * 0.6);
    vec2 b = abs(q) - vec2(size, size * 0.55);
    float d = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0);
    debris = max(debris, 1.0 - smoothstep(0.0, 0.006, d));
  }
  float v = max(ring, debris * smoothstep(1.0, 0.7, t));
  return vec4(vec3(saturate(v)), 1.0);
}
