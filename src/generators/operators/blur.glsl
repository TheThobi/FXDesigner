// Blur: Gaussian (hierarchical separable passes, see blur-pass.glsl; this pass only
// un-premultiplies) or directional (motion blur along an angle, one tap per pixel of length).
// Radius in px @512; sampling adapts to the radius. Wraps around the edges (seamless inputs
// stay seamless).
vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec4 sum;
  if (u_mode == 0) {
    sum = texture(u_prev, uv);
  } else {
    float refPx = max(u_resolution.x, u_resolution.y) / 512.0;
    float lengthPx = 2.0 * u_radius * refPx;
    int n = clamp(int(ceil(lengthPx)) + 1, 8, 512);
    vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle))) * u_radius * refPx / u_resolution;
    sum = vec4(0.0);
    for (int i = 0; i < 512; i++) {
      if (i >= n) break;
      float t = float(i) / float(n - 1) * 2.0 - 1.0;
      vec4 c = texture(u_in_image, fract(uv + dir * t));
      sum += vec4(c.rgb * c.a, c.a);
    }
    sum /= float(n);
  }
  return vec4(sum.rgb / max(sum.a, 1e-5), sum.a);
}
