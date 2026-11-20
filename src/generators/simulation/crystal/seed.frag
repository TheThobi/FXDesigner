// r = crystal (0/1), g = potential field, b = birth time (frames / 4096).
void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 size = u_gridSize;
  vec2 rel = cell - floor(size * 0.5);
  float c = 0.0;
  if (u_seedMode == 0) c = length(rel) < 1.5 ? 1.0 : 0.0;
  else if (u_seedMode == 1) c = cell.y < 1.0 ? 1.0 : 0.0;
  else if (u_seedMode == 2) c = step(0.9993, hash12(cell + 0.5));
  else c = abs(length(rel) - size.x * 0.35) < 0.75 ? 1.0 : 0.0;
  outColor = vec4(c, 1.0 - c, 0.0, 1.0);
}
