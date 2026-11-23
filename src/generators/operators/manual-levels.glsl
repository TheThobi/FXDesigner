vec4 generate(vec2 uv) {
  vec4 c = u_has_image ? texture(u_in_image, uv) : vec4(0.0);
  vec3 v = clamp((c.rgb - u_inLow) / max(u_inHigh - u_inLow, 1e-4), 0.0, 1.0);
  v = pow(v, vec3(1.0 / max(u_gamma, 1e-3)));
  return vec4(mix(vec3(u_outLow), vec3(u_outHigh), v), c.a);
}
