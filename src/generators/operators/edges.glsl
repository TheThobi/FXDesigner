// Edge Detect: Sobel on the Image luminance (width in px @512), as bright lines.
float lumAt(vec2 uv) {
  vec4 c = texture(u_in_image, fract(uv));
  return luminance(c.rgb) * c.a;
}

vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec2 e = vec2(u_width / 512.0, 0.0);
  float tl = lumAt(uv + vec2(-e.x, e.x)), t = lumAt(uv + e.yx), tr = lumAt(uv + vec2(e.x, e.x));
  float l = lumAt(uv - e), r = lumAt(uv + e);
  float bl = lumAt(uv - vec2(e.x, e.x)), b = lumAt(uv - e.yx), br = lumAt(uv + vec2(e.x, -e.x));
  float gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
  float gy = (tl + 2.0 * t + tr) - (bl + 2.0 * b + br);
  float v = length(vec2(gx, gy)) * u_strength;
  v = smoothstep(u_threshold, u_threshold + 0.05, v) * min(v, 1.0);
  return vec4(vec3(saturate(v)), 1.0);
}
