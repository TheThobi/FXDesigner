// Crystal facets / shattered noise: each Voronoi cell is a tilted plane, giving flat-shaded
// chiselled facets (the base of hand-painted rocks and gems). Seamless.
vec4 generate(vec2 uv) {
  float scale = max(1.0, floor(u_scale + 0.5));
  vec4 c = voronoiNearest(uv * scale, vec2(scale), u_jitter);
  vec2 dir = normalize(hash22(vec2(c.w, 7.1)) * 2.0 - 1.0 + 1e-4);
  float plane = dot(-c.xy, dir) * u_slope;
  float v = 0.5 + (hash12(vec2(c.w, 3.3)) - 0.5) * u_variation + plane * 0.5;
  float aa = scale * 2.0 / u_resolution.x;
  float crack = 1.0 - smoothstep(u_crackWidth, u_crackWidth + aa, c.z);
  v = mix(v, 0.0, crack * u_crackDarkness);
  return vec4(vec3(saturate(v)), 1.0);
}
