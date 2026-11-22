// Reduce 4x4 source blocks into (min, max, valid), then reduce those blocks to 1x1.
vec4 generate(vec2 uv) {
  bool first = u_passIndex == 0;
  ivec2 size = first ? textureSize(u_in_image, 0) : textureSize(u_prev, 0);
  ivec2 origin = ivec2(gl_FragCoord.xy) * 4;
  vec3 range = vec3(0.0);
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      ivec2 p = origin + ivec2(x, y);
      if (any(greaterThanEqual(p, size))) continue;
      vec3 entry;
      if (first) {
        vec4 color = texelFetch(u_in_image, p, 0);
        if (u_ignoreTransparent && color.a <= 0.0) continue;
        float lum = luminance(saturate(color.rgb));
        entry = vec3(lum, lum, 1.0);
      } else {
        entry = texelFetch(u_prev, p, 0).rgb;
        if (entry.z < 0.5) continue;
      }
      range = range.z < 0.5 ? entry : vec3(min(range.x, entry.x), max(range.y, entry.y), 1.0);
    }
  }
  return vec4(range, 1.0);
}
