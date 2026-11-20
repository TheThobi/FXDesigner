// Stylized water surface: foam lines on Voronoi borders (exact, uniform widths) over flat
// water, two layers. Points orbit around rest positions so cells never collapse. Seamless.
// Tones: ~0.25 water, 0.6 secondary lines, 1.0 foam.
vec4 generate(vec2 uv) {
  float scale = max(1.0, floor(u_scale + 0.5));
  vec2 period = vec2(scale);
  float t = u_time * u_speed;
  vec2 p = uv * scale;
  p += u_distortion * vec2(fbm(p, 3, 2.0, 0.5, period, t, FBM_STANDARD),
                           fbm(p + 7.3, 3, 2.0, 0.5, period, t, FBM_STANDARD));
  float aa = scale * 2.0 / u_resolution.x;
  vec4 c = voronoiNearest(p, period, 1.0, t * 2.0);
  float foam = 1.0 - smoothstep(u_lineWidth * 0.5, u_lineWidth * 0.5 + aa, c.z);
  vec4 c2 = voronoiNearest(p * 2.0 + 3.1, period * 2.0, 1.0, -t * 1.5);
  float foam2 = 1.0 - smoothstep(u_lineWidth * 0.35, u_lineWidth * 0.35 + aa * 2.0, c2.z);
  float v = 0.25 + 0.15 * length(c.xy) * u_shading;
  v = max(v, 0.6 * foam2 * u_secondLayer);
  v = max(v, foam);
  return vec4(vec3(v), 1.0);
}
