// Impact shards: triangular radial spikes of random length around a gap, with a center flash.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float r = length(p);
  float a = atan(p.y, p.x) + radians(u_rotation);
  float n = float(u_shards);
  float sector = TAU / n;
  float k = floor(a / sector + 0.5);
  float da = a - k * sector;
  float h1 = hash12(vec2(mod(k, n), 1.3));
  float h2 = hash12(vec2(mod(k, n), 5.1));
  float inner = u_innerRadius * mix(1.0, 0.6 + 0.8 * h2, u_randomness);
  float outer = mix(inner + 0.1, u_outerRadius, mix(1.0, 0.4 + 0.6 * h1, u_randomness));
  float t = saturate((r - inner) / max(outer - inner, 1e-3));
  float halfWidth = u_width * sector * 0.5 * (1.0 - t) * mix(1.0, 0.6 + 0.8 * h1, u_randomness * 0.5);
  float aa = 1.5 / u_resolution.x / max(r, 1e-3);
  float m = (1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(da))) * step(inner, r) * step(r, outer);
  float v = m * mix(1.0, 0.45, t * u_tipFade);
  v = max(v, u_flash * radialFalloff(r, max(u_innerRadius, 0.05) * 1.3, 2.0));
  return vec4(vec3(saturate(v)), 1.0);
}
