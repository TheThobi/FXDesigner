// Domain-warped fBm (fBm evaluated at coordinates displaced by other fBm), after I. Quilez.
// Stays seamless: a periodic displacement of a periodic function is periodic.
vec4 generate(vec2 uv) {
  float scale = u_tileable ? max(1.0, floor(u_scale + 0.5)) : u_scale;
  vec2 period = u_tileable ? vec2(scale) : vec2(0.0);
  float flow = loopFlow(u_speed);
  vec2 p = uv * scale;
  vec2 q = vec2(fbm(p, u_octaves, 2.0, 0.5, period, flow, FBM_STANDARD),
                fbm(p + vec2(5.2, 1.3), u_octaves, 2.0, 0.5, period, flow, FBM_STANDARD));
  vec2 r = vec2(fbm(p + u_warp * q + vec2(1.7, 9.2), u_octaves, 2.0, 0.5, period, flow, FBM_STANDARD),
                fbm(p + u_warp * q + vec2(8.3, 2.8), u_octaves, 2.0, 0.5, period, flow, FBM_STANDARD));
  float n = fbm(p + u_warp * r, u_octaves, 2.0, 0.5, period, flow, FBM_STANDARD);
  float v = saturate(0.5 + 0.9 * n);
  if (u_output == 1) {
    vec3 col = mix(vec3(0.10, 0.30, 0.40), vec3(0.95, 0.65, 0.30), v);
    col = mix(col, vec3(0.20, 0.08, 0.45), saturate(length(q)));
    col = mix(col, vec3(1.0), saturate(r.x * r.x) * 0.5);
    return vec4(col * (0.4 + v), 1.0);
  }
  return vec4(vec3(v), 1.0);
}
