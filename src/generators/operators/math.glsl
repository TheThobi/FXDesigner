vec4 generate(vec2 uv) {
  vec4 c = u_has_image ? texture(u_in_image, uv) : vec4(0.0);
  vec3 v = pow(max(c.rgb, 0.0), vec3(u_power)) * u_gain + u_bias;
  if (u_fold) v = abs(v * 2.0 - 1.0);
  if (u_threshold > 0.0) {
    float s = max(u_softness, 1e-4);
    v = smoothstep(vec3(u_threshold - s), vec3(u_threshold + s), v);
  }
  if (u_invert) v = 1.0 - v;
  if (u_clampValue) v = clamp(v, 0.0, 1.0);
  return vec4(v, c.a);
}
