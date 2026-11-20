// Star flare: sharp tapered rays, optional secondary rays, glow and core.
float rays(vec2 p, float count, float len, float width, float randomness, float salt) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float sector = TAU / count;
  float k = floor(a / sector + 0.5);
  float da = a - k * sector;
  float h = hash12(vec2(mod(k, count), salt));
  float l = len * mix(1.0, 0.35 + 0.65 * h, randomness);
  float t = saturate(r / max(l, 1e-4));
  float w = max(width * (1.0 - t), 1e-4);
  float d = r * abs(sin(da));
  return (1.0 - smoothstep(0.0, w, d)) * pow(1.0 - t, 2.0);
}

vec4 generate(vec2 uv) {
  vec2 p = rotate2d(centered(uv), radians(u_rotation) + u_time * u_speed);
  float count = float(u_rays);
  float v = rays(p, count, u_rayLength, u_rayWidth, u_randomness, 1.0);
  if (u_secondary) {
    v += 0.6 * rays(rotate2d(p, PI / count), count, u_rayLength * 0.5, u_rayWidth * 0.7, u_randomness, 2.0);
  }
  float r = length(p);
  v += u_glow * radialFalloff(r, u_glowSize, 3.0);
  v += u_core > 0.0 ? 1.0 - smoothstep(0.0, u_core, r) : 0.0;
  return vec4(vec3(saturate(v)), 1.0);
}
