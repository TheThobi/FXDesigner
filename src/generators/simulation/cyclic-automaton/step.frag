// Cyclic cellular automaton (Griffeath): a cell in state s advances to s+1 (mod N) when at
// least `threshold` neighbours within `range` are already in state s+1.
int stateOf(vec4 v) { return int(floor(v.r * 32.0 + 0.5)); }

void main() {
  int n = u_states;
  int s = stateOf(neighbor(0, 0));
  int next = (s + 1) % n;
  int count = 0;
  for (int y = -3; y <= 3; y++) {
    for (int x = -3; x <= 3; x++) {
      if (abs(x) > u_range || abs(y) > u_range || (x == 0 && y == 0)) continue;
      if (u_neighborhood == 1 && abs(x) + abs(y) > u_range) continue; // von Neumann
      if (stateOf(neighbor(x, y)) == next) count++;
    }
  }
  if (count >= u_threshold) s = next;

  int brush = brushMode();
  if (brush == 1) s = int(floor(hash12(gl_FragCoord.xy + u_frame * 1.7) * float(n)));
  else if (brush == 2) s = 0;

  outColor = vec4(float(s) / 32.0, 0.0, 0.0, 1.0);
}
