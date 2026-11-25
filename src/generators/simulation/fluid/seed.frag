// State: rg = velocity (cells / step), b = pressure, a = dye. State 2: rgb = ink color
// premultiplied by the dye (advected like it).
void main() {
  vec2 uv = (floor(gl_FragCoord.xy) + 0.5) / u_gridSize;
  float dye = 0.0;
  if (u_dyeStart == 1) dye = step(0.5, fract(uv.y * float(u_dyeBands)));
  else if (u_dyeStart == 2) dye = step(0.5, fract((uv.x + uv.y) * float(u_dyeBands) * 0.5)) * 0.5 +
                                  step(0.5, fract(uv.x * float(u_dyeBands))) * 0.5;
  else if (u_dyeStart == 3) dye = 0.5 + 0.5 * fbm(uv * 4.0, 4, 2.0, 0.5, vec2(4.0), 0.0, FBM_STANDARD);
  outColor = vec4(0.0, 0.0, 0.0, dye);
  // Colors: one per band (stripes), per diagonal (checker), or blended by noise (clouds).
  vec3 ink = u_inkA;
  if (u_dyeStart == 1) {
    float k = mod(floor(uv.y * float(u_dyeBands)), 3.0);
    ink = k < 0.5 ? u_inkA : k < 1.5 ? u_inkB : u_inkC;
  } else if (u_dyeStart == 2) {
    ink = mod(floor(uv.x * float(u_dyeBands)), 2.0) < 0.5 ? u_inkA : u_inkB;
  } else if (u_dyeStart == 3) {
    float n = 0.5 + 0.5 * fbm(uv * 3.0 + 7.0, 3, 2.0, 0.5, vec2(3.0), 0.0, FBM_STANDARD);
    ink = n < 0.5 ? mix(u_inkA, u_inkB, n * 2.0) : mix(u_inkB, u_inkC, n * 2.0 - 1.0);
  }
  outColor2 = vec4(ink * dye, 0.0);
}
