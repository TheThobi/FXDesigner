// Levels & Math on the color (alpha untouched): input range -> gamma -> output range, then
// power / multiply / add, fold (|2v - 1|), threshold, invert, clamp.
vec4 generate(vec2 uv) {
  vec4 c = u_has_image ? texture(u_in_image, uv) : vec4(0.0);
  vec3 v = max((c.rgb - u_inLow) / max(u_inHigh - u_inLow, 1e-4), 0.0);
  v = pow(v, vec3(1.0 / max(u_gamma, 1e-3)));
  v = mix(vec3(u_outLow), vec3(u_outHigh), v);
  v = pow(max(v, 0.0), vec3(u_power)) * u_gain + u_bias;
  if (u_fold) v = abs(v * 2.0 - 1.0);
  if (u_threshold > 0.0) {
    float s = max(u_softness, 1e-4);
    v = smoothstep(vec3(u_threshold - s), vec3(u_threshold + s), v);
  }
  if (u_invert) v = 1.0 - v;
  if (u_clampValue) v = clamp(v, 0.0, 1.0);
  return vec4(v, c.a);
}
