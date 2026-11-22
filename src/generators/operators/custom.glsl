// Custom Code: the node's GLSL snippet edits `vec4 v` per pixel (USER_CODE marker below is
// replaced by it). Inputs A / B / C are read with a(uv), b(uv), c(uv).
vec4 a(vec2 p) { return u_has_a ? texture(u_in_a, fract(p)) : vec4(0.0); }
vec4 b(vec2 p) { return u_has_b ? texture(u_in_b, fract(p)) : vec4(0.0); }
vec4 c(vec2 p) { return u_has_c ? texture(u_in_c, fract(p)) : vec4(0.0); }

void customCode(inout vec4 v, vec2 uv, float t, vec2 px) {
  /*USER_CODE*/
}

vec4 generate(vec2 uv) {
  vec4 v = a(uv);
  customCode(v, uv, u_time, 1.0 / u_resolution);
  return v;
}
