// r = state (0 dead, 1 alive, intermediate = dying "generations" states), g = history glow.
void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 size = u_gridSize;
  float alive;
  if (u_seedMode == 0) alive = step(1.0 - u_seedDensity, hash12(cell + 0.5));
  else {
    vec2 rel = abs(cell - size * 0.5);
    alive = step(max(rel.x, rel.y), size.x * 0.12) * step(0.5, hash12(cell + 2.0));
  }
  outColor = vec4(alive, alive, 0.0, 1.0);
}
