// Random soup of soft blobs (r = state A in [0, 1]); g keeps a slow trail for rendering.
void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 size = u_gridSize;
  float a = 0.0;
  if (u_seedMode == 0) {
    // Patches of noise: Lenia creatures emerge from noisy patches of the right size.
    float patchCells = float(u_radius) * 3.0;
    vec2 patchId = floor(cell / patchCells);
    float on = step(1.0 - u_seedDensity, hash12(patchId + 17.0));
    a = on * hash12(cell + 0.5);
  } else if (u_seedMode == 1) {
    vec2 rel = cell - size * 0.5;
    float r = float(u_radius) * 2.0;
    a = length(rel) < r ? hash12(cell + 3.0) : 0.0;
  } else {
    a = hash12(cell + 9.0) * step(0.55, hash12(cell * 0.37 + 1.0));
  }
  outColor = vec4(a, a, 0.0, 1.0);
}
