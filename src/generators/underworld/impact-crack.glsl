// Ground impact decal: jagged radial cracks with branches, a scorched ring and a hot center.
float crackLine(vec2 p, float angle, float len, float seed) {
  vec2 dir = vec2(cos(angle), sin(angle));
  float along = dot(p, dir);
  if (along < 0.0 || along > len) return 8.0;
  float side = dot(p, vec2(-dir.y, dir.x));
  float jag = (fbm(vec2(along * 8.0, seed * 17.0), 3)) * 0.08 * u_jaggedness * along / len;
  float width = mix(0.012, 0.002, along / len);
  return abs(side - jag) - width;
}

vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float aa = 3.0 / u_resolution.x;
  float d = 8.0;
  for (int i = 0; i < 16; i++) {
    if (i >= u_cracks) break;
    float fi = float(i);
    float h = hash12(vec2(fi, u_seed + 1.3));
    float ang = (fi + h * 0.6) / float(u_cracks) * TAU;
    float len = u_length * (0.55 + 0.45 * hash12(vec2(fi, 4.4)));
    d = min(d, crackLine(p, ang, len, fi));
    if (hash12(vec2(fi, 9.9)) < u_branches) {
      float at = len * (0.35 + 0.3 * hash12(vec2(fi, 6.6)));
      vec2 base = vec2(cos(ang), sin(ang)) * at;
      float bang = ang + (hash12(vec2(fi, 7.7)) > 0.5 ? 0.6 : -0.6);
      d = min(d, crackLine(p - base, bang, len * 0.45, fi + 50.0));
    }
  }
  float cracks = 1.0 - smoothstep(-aa, aa, d);
  float r = length(p);
  float scorch = smoothstep(u_length * 0.75, 0.0, r) * u_scorch * (0.6 + 0.4 * fbm(p * 6.0, 3));
  float hot = exp(-r * r / 0.01) * u_glow;
  float crackGlow = exp(-max(d, 0.0) * 60.0) * u_glow * smoothstep(u_length, 0.0, r);
  float v = max(max(cracks * 0.9, crackGlow), hot);
  // Scorch darkens: encode as alpha so the decal multiplies the ground.
  float alpha = saturate(max(v, scorch));
  return vec4(vec3(v), alpha);
}
