// Water caustics by iterated trigonometric warping (after the classic "tileable water caustic"
// technique). The original divided by the raw coordinate, which broke tiling; it is replaced by
// a constant here so the pattern is exactly periodic.
vec4 generate(vec2 uv) {
  float time = u_time * u_speed + 23.0 + u_seed * 3.17;
  vec2 p = mod(uv * TAU * float(u_scale), TAU) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float k = 247.0 * u_intensity;
  for (int n = 0; n < 8; n++) {
    if (n >= u_iterations) break;
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(k / sin(i.x + t), k / cos(i.y + t)));
  }
  c /= float(u_iterations);
  c = 1.17 - pow(c, 1.4);
  return vec4(vec3(saturate(pow(abs(c), u_sharpness))), 1.0);
}
