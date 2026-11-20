// Thin curling smoke strand rising from the bottom: a ribbon whose centerline meanders with
// noise and curls more with height, thinning and breaking up toward the top.
vec4 generate(vec2 uv) {
  vec2 p = centered(uv);
  float t = u_time * u_speed;
  float h = saturate((p.y + 0.9) / (1.8 * u_length));
  float sway = fbm(vec2(p.y * 1.5 - t * 0.6, 3.1), 3) * u_curl * h;
  float curls = sin(p.y * 7.0 * max(u_curl, 0.1) - t * 2.5) * 0.12 * u_curl * h * h;
  float x = p.x - sway - curls;
  float n = fbm(vec2(x * u_detail * 2.0, p.y * u_detail - t), 4);
  float w = u_width * mix(0.11, 0.035, h);
  float d = abs(x + n * 0.03) / w;
  float strand = exp(-d * d * mix(1.0, 5.0, 1.0 - u_softness));
  float broken = smoothstep(-0.1, 0.5, n + (1.0 - h) * 1.2 - u_breakup * 0.6);
  float fade = smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.7, 1.0, h));
  float v = strand * mix(1.0, broken, u_breakup) * fade;
  return vec4(vec3(saturate(v * 1.3)), 1.0);
}
