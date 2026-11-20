// Belousov-Zhabotinsky as a 3-species cyclic reaction (after Alasdair Turner):
//   a' = a + a (α b − γ c),  b' = b + b (β c − α a),  c' = c + c (γ a − β b)
// evaluated on neighbourhood-averaged concentrations. Produces rotating spiral waves.
void main() {
  vec3 center = neighbor(0, 0).rgb;
  vec3 c = mix(center, boxAverage().rgb, u_diffusion);
  vec3 r = c + u_rate * c * vec3(u_alpha * c.y - u_gamma * c.z,
                                 u_beta * c.z - u_alpha * c.x,
                                 u_gamma * c.x - u_beta * c.y);
  int brush = brushMode();
  if (brush == 1) r = vec3(hash12(gl_FragCoord.xy + u_frame), hash12(gl_FragCoord.yx + u_frame), 0.5);
  else if (brush == 2) r = vec3(0.0);
  outColor = vec4(saturate(r), 1.0);
}
