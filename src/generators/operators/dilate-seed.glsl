// Dilate, pass 1: seeds of the jump flood. RG = this pixel if it is solid (alpha above the
// threshold), else -1. Pixel coordinates (BA unused, kept for the shared jump pass).
vec4 generate(vec2 uv) {
  vec2 p = floor(gl_FragCoord.xy);
  vec4 c = texture(u_in_image, (p + 0.5) / u_resolution);
  bool solid = u_has_image && c.a > u_threshold;
  return solid ? vec4(p, -1.0, -1.0) : vec4(-1.0);
}
