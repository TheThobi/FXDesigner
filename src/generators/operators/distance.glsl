// Distance (Substance Designer-like): exact distance field of the Mask shapes, computed by
// jump flooding. Outside: 1 on the shapes fading to 0 at Max distance; Inside: 0 at the
// border rising to 1 inside (bevel); Signed: 0.5 on the border. A connected Source spreads its
// colors from the shapes (each pixel takes the color of its nearest shape pixel).
vec4 generate(vec2 uv) {
  if (!u_has_mask) return vec4(0.0);
  vec2 p = floor(gl_FragCoord.xy);
  vec4 s = texelFetch(u_prev, ivec2(p), 0);
  // Distances in px @512 (resolution independent).
  float refPx = max(u_resolution.x, u_resolution.y) / 512.0;
  float maxD = max(u_maxDistance, 1e-3);
  vec2 dOut = s.x >= 0.0 ? s.xy - p : vec2(1e6);
  vec2 dIn = s.z >= 0.0 ? s.zw - p : vec2(1e6);
  if (u_tile) {
    dOut -= u_resolution * floor(dOut / u_resolution + 0.5);
    dIn -= u_resolution * floor(dIn / u_resolution + 0.5);
  }
  // Half a pixel: the border lies between a shape pixel and its empty neighbour.
  float outside = max(length(dOut) - 0.5, 0.0) / refPx;
  float inside = max(length(dIn) - 0.5, 0.0) / refPx;
  float v;
  if (u_mode == 0) v = 1.0 - outside / maxD;
  else if (u_mode == 1) v = inside / maxD;
  else v = 0.5 + (inside - outside) / (2.0 * maxD);
  v = pow(saturate(v), u_falloff);
  if (!u_has_source) return vec4(vec3(v), 1.0);
  // Color propagation from the nearest shape pixel.
  if (s.x < 0.0) return vec4(0.0);
  vec4 c = texture(u_in_source, (s.xy + 0.5) / u_resolution);
  float fade = u_combine ? v : 1.0;
  return vec4(c.rgb * fade, c.a * (outside <= maxD ? 1.0 : 0.0));
}
