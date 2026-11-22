float edgeWeight(float distanceToEdge, float width) {
  if (width <= 0.0) return 1.0;
  float t = saturate((distanceToEdge - width * u_inset) / (width * (1.0 - u_inset)));
  if (u_curve == 1) t = smoothstep(0.0, 1.0, t);
  if (u_curve == 2) t *= t;
  if (u_curve == 3) t = sqrt(t);
  return t;
}

vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec4 src = texture(u_in_image, uv);
  vec2 farEdge = 1.0 - uv;
  vec4 edges = vec4(edgeWeight(uv.x, u_left), edgeWeight(farEdge.x, u_right),
                    edgeWeight(farEdge.y, u_top), edgeWeight(uv.y, u_bottom));
  float weight = u_corners == 0
    ? min(min(edges.x, edges.y), min(edges.z, edges.w))
    : edges.x * edges.y * edges.z * edges.w;
  weight = mix(1.0, weight, u_amount);
  if (u_channels != 0) src.rgb *= weight;
  if (u_channels != 1) src.a *= weight;
  return src;
}
