// Stylized leaf sprite: pointed blade with a midrib, side veins and optional serrated edge;
// bends and flutters. Shape in alpha, soft value shading in rgb.
vec4 generate(vec2 uv) {
  vec2 p = rotate2d(centered(uv), radians(u_rotation));
  float t = u_time * u_speed;
  float bend = u_bend + 0.12 * sin(t * 3.0);
  p.x -= bend * (p.y + 0.8) * (p.y + 0.8) * 0.3;
  float y = (p.y + 0.7) / 1.5;
  float aa = 3.0 / u_resolution.x;

  float prof = u_width * pow(max(sin(PI * clamp(y, 0.0, 1.0)), 0.0), u_roundness);
  prof *= mix(1.0, 1.0 - clamp(y, 0.0, 1.0), clamp(u_tipSharpness * 0.4, 0.0, 1.0));
  prof -= u_serration * 0.035 * abs(sin(y * float(u_serrationCount) * PI));
  float inside = (1.0 - smoothstep(-aa, aa, abs(p.x) - prof)) * step(0.0, y) * step(y, 1.0);

  float stemY = clamp(-y / max(u_stemLength, 1e-3), 0.0, 1.0);
  float stem = (1.0 - smoothstep(0.006, 0.006 + aa, abs(p.x))) * step(y, 0.0) * step(stemY, 0.999);

  float midrib = 1.0 - smoothstep(0.004, 0.012, abs(p.x));
  float nv = float(u_veins);
  float side = abs(fract(y * nv - abs(p.x) * nv * 1.3) - 0.5);
  float veins = u_veins > 0 ? max(midrib, (1.0 - smoothstep(0.03, 0.09, side)) * 0.7) : midrib;
  float shade = mix(0.6, 1.0, 1.0 - abs(p.x) / max(prof, 1e-3));
  float value = shade * (1.0 - veins * u_veinStrength * 0.5);
  return vec4(vec3(value * inside + stem * 0.45), max(inside, stem));
}
