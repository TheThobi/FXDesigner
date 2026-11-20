// Divine aura: swirling petal-like flames around a glowing center, with rising sparkles —
// the radial "blessing" burst of action RPG boons.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float t = u_time * u_speed;
  float r = length(p);
  float a = atan(p.y, p.x);
  float swirl = a + u_twist * r - t * 0.8;
  float petals = 0.5 + 0.5 * cos(swirl * float(u_petals));
  float n = 0.5 + 0.5 * polarNoise(p, float(u_petals) * 2.0, r * 3.0 - t * 1.5, 3);
  float shape = pow(petals, mix(4.0, 1.0, u_softness)) * (0.6 + 0.6 * n);
  float reach = u_radius * (0.75 + 0.35 * shape);
  float body = (1.0 - smoothstep(reach * 0.7, reach, r)) * smoothstep(0.0, u_radius * 0.25, r);
  float core = exp(-r * r / max(u_radius * u_radius * 0.04, 1e-4));
  float v = max(body * (0.45 + 0.55 * shape), core);
  // Rising sparkles around the aura.
  for (int i = 0; i < 24; i++) {
    if (i >= u_sparkles) break;
    float fi = float(i);
    float h = hash12(vec2(fi, 2.7));
    float life = fract(t * 0.4 + h);
    float ang = h * TAU + life * 1.5;
    vec2 c = vec2(cos(ang), sin(ang)) * u_radius * (0.5 + 0.6 * life) + vec2(0.0, life * 0.3);
    float sz = 0.025 * (1.0 - life);
    v = max(v, exp(-dot(p - c, p - c) / max(sz * sz, 1e-5)) * (1.0 - life));
  }
  return vec4(vec3(saturate(v)), 1.0);
}
