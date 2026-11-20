// State: rg = velocity (cells / step), b = pressure, a = dye.
void main() {
  vec2 uv = (floor(gl_FragCoord.xy) + 0.5) / u_gridSize;
  float dye = 0.0;
  if (u_dyeStart == 1) dye = step(0.5, fract(uv.y * float(u_dyeBands)));
  else if (u_dyeStart == 2) dye = step(0.5, fract((uv.x + uv.y) * float(u_dyeBands) * 0.5)) * 0.5 +
                                  step(0.5, fract(uv.x * float(u_dyeBands))) * 0.5;
  else if (u_dyeStart == 3) dye = 0.5 + 0.5 * fbm(uv * 4.0, 4, 2.0, 0.5, vec2(4.0), 0.0, FBM_STANDARD);
  outColor = vec4(0.0, 0.0, 0.0, dye);
}
