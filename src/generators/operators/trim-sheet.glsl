// Trim Sheet: the connected inputs stacked top-down as horizontal strips (sizes by weight).
// Repeat keeps texels square (the input repeats along X, seamless inputs stay seamless);
// Stretch fits it once. Gutters show the strips' edge rows (no bleeding in mipmaps).
vec4 strip(int i, vec2 p) {
  if (i == 0) return texture(u_in_s1, p);
  if (i == 1) return texture(u_in_s2, p);
  if (i == 2) return texture(u_in_s3, p);
  if (i == 3) return texture(u_in_s4, p);
  if (i == 4) return texture(u_in_s5, p);
  return texture(u_in_s6, p);
}

float weight(int i) {
  if (i == 0) return u_has_s1 ? u_size1 : 0.0;
  if (i == 1) return u_has_s2 ? u_size2 : 0.0;
  if (i == 2) return u_has_s3 ? u_size3 : 0.0;
  if (i == 3) return u_has_s4 ? u_size4 : 0.0;
  if (i == 4) return u_has_s5 ? u_size5 : 0.0;
  return u_has_s6 ? u_size6 : 0.0;
}

vec4 generate(vec2 uv) {
  float total = 0.0;
  for (int i = 0; i < 6; i++) total += weight(i);
  if (total <= 0.0) return vec4(0.0);
  float y = 1.0 - uv.y; // top-down
  float gutter = u_gutter / max(u_resolution.y, 1.0);
  float top = 0.0;
  for (int i = 0; i < 6; i++) {
    float w = weight(i) / total;
    if (w <= 0.0) continue;
    if (y <= top + w + 1e-6) {
      // Inner area without half a gutter on each internal side; gutters clamp to edges.
      float t0 = top + (top > 1e-6 ? gutter * 0.5 : 0.0);
      float t1 = top + w - (top + w < 1.0 - 1e-6 ? gutter * 0.5 : 0.0);
      float local = clamp((y - t0) / max(t1 - t0, 1e-6), 0.0, 1.0);
      float aspect = u_resolution.x / max((t1 - t0) * u_resolution.y, 1.0);
      float x = u_mode == 0 ? uv.x * max(1.0, floor(aspect + 0.5)) : uv.x;
      return strip(i, vec2(fract(x), 1.0 - local));
    }
    top += w;
  }
  return vec4(0.0);
}
