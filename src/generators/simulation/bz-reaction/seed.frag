// Random concentrations of the three species (r, g, b).
void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  outColor = vec4(hash12(cell), hash12(cell + 37.1), hash12(cell + 71.7), 1.0);
}
