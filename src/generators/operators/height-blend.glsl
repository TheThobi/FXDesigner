// Height Blend: A and B mixed by their heights, the highest wins with a soft transition
// (lava rising between stones, moss on top of bricks). Heights default to the images'
// brightness; Offset raises B.
float hgt(sampler2D tex, bool has, vec4 fallback, vec2 uv) {
  vec4 c = has ? texture(tex, uv) : fallback;
  return luminance(c.rgb) * c.a;
}

vec4 generate(vec2 uv) {
  vec4 a = u_has_a ? texture(u_in_a, uv) : vec4(0.0, 0.0, 0.0, 1.0);
  vec4 b = u_has_b ? texture(u_in_b, uv) : vec4(1.0);
  float ha = hgt(u_in_heightA, u_has_heightA, a, uv);
  float hb = hgt(u_in_heightB, u_has_heightB, b, uv) + u_offset;
  float t = max(u_contrast, 1e-3) * 0.25;
  float k = smoothstep(-t, t, hb - ha);
  vec4 out4 = mix(a, b, k);
  if (u_output == 1) return vec4(vec3(k), 1.0);
  if (u_output == 2) return vec4(vec3(saturate(max(ha, hb))), 1.0);
  return out4;
}
