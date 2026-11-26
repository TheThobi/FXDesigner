// Dilate / padding: transparent pixels take the color of the nearest solid pixel (jump flood,
// see distance-jump.glsl), up to Padding px @512 or everywhere. Alpha is kept by default, so
// the image looks the same but its mipmaps no longer bleed dark or stray colors from the
// transparent area onto alpha-cutout edges.
vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec2 p = floor(gl_FragCoord.xy);
  vec4 c = texture(u_in_image, (p + 0.5) / u_resolution);
  if (c.a > u_threshold) return c;
  vec4 s = texelFetch(u_prev, ivec2(p), 0);
  if (s.x < 0.0) return c;
  vec2 d = s.xy - p;
  if (u_tile) d -= u_resolution * floor(d / u_resolution + 0.5);
  float refPx = max(u_resolution.x, u_resolution.y) / 512.0;
  if (!u_infinite && length(d) > u_padding * refPx + 0.5) return c;
  vec3 rgb = texture(u_in_image, (s.xy + 0.5) / u_resolution).rgb;
  return vec4(rgb, u_alpha == 1 ? 1.0 : c.a);
}
