// Distance, pass 1: seeds of the jump flood. RG = this pixel if it is on a shape, BA = this
// pixel if it is empty (inside distances); -1 = no seed yet. Pixel coordinates.
vec4 generate(vec2 uv) {
  vec2 p = floor(gl_FragCoord.xy);
  vec4 c = texture(u_in_mask, (p + 0.5) / u_resolution);
  bool shape = u_has_mask && luminance(c.rgb) * c.a > u_threshold;
  return shape ? vec4(p, -1.0, -1.0) : vec4(-1.0, -1.0, p);
}
