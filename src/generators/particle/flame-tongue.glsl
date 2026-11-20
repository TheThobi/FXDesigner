// Single flame tongue for particle systems: rounded bulb, tapered tip, upward-scrolling
// turbulence growing toward the tip, brighter core.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float t = u_time * u_speed;
  float h = saturate((p.y + 0.75) / 1.6);
  float n = fbm(vec2(p.x * 3.0, p.y * 2.0 - t * 2.0), 4);
  vec2 q = p + vec2(n * u_turbulence * 0.3 * h, 0.0);
  float bulb = 0.32 * u_width;
  float y = q.y + 0.4;
  float profile = y < 0.0 ? sqrt(max(bulb * bulb - y * y, 0.0))
                          : bulb * pow(max(1.0 - y / u_height, 0.0), u_sharpness);
  float d = abs(q.x) - profile;
  float soft = 0.01 + u_softness * 0.12;
  float shape = 1.0 - smoothstep(-soft, 0.005, d);
  float core = 1.0 - smoothstep(-profile * 0.9, -profile * 0.25, d);
  float v = shape * mix(0.55, 1.0, core) * (0.85 + 0.3 * n);
  return vec4(vec3(saturate(v)), 1.0);
}
