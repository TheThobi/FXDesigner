// Burning paper. State: r = burnt (0 paper → 1 consumed), g = fire (1 while burning),
// b = fuel (paper presence × fiber density), a = scorch (heat received before igniting).
void main() {
  vec2 uv = (floor(gl_FragCoord.xy) + 0.5) / u_gridSize;
  vec2 cells = u_gridSize / min(u_gridSize.x, u_gridSize.y);
  // Paper fibers: stretched noise, plus fine grain.
  vec2 k = floor(cells * 6.0 + 0.5);
  float fibers = 0.5 + 0.5 * fbm(uv * k * vec2(1.0, 3.0), 4, 2.0, 0.5, k * vec2(1.0, 3.0), 0.0, FBM_STANDARD);
  float fuel = mix(1.0, 0.55 + 0.9 * fibers, u_fibers);
  if (u_has_paper) {
    vec4 p = texture(u_in_paper, uv);
    fuel *= luminance(p.rgb) * p.a;
  }
  float fire = 0.0;
  vec2 c = (uv - 0.5) * cells;
  if (u_start == 0) fire = step(length(c), 3.0 / min(u_gridSize.x, u_gridSize.y));
  else if (u_start == 1) fire = step(gl_FragCoord.y, 1.5);
  else if (u_start == 2) fire = step(hash12(floor(gl_FragCoord.xy) + u_seed), 0.0006);
  outColor = vec4(0.0, fire * step(0.05, fuel), clamp(fuel, 0.0, 1.0), 0.0);
}
