// "Generations" cellular automata (Mirek Wójtowicz's notation B/S/C): a dead cell is born with
// a count in B, a live one survives with a count in S, otherwise it starts dying through C−2
// refractory states. Rules are bit masks: bit n set = n live neighbours qualifies.
// Larger than Life rules use a wider neighbourhood (range) with interval rules.

bool inMask(int mask, int n) { return n < 30 && ((mask >> n) & 1) == 1; }

void main() {
  vec4 s = neighbor(0, 0);
  int range = u_rule == 6 ? 5 : 1;
  int count = 0;
  for (int y = -5; y <= 5; y++) {
    if (abs(y) > range) continue;
    for (int x = -5; x <= 5; x++) {
      if (abs(x) > range || (x == 0 && y == 0)) continue;
      if (neighbor(x, y).r > 0.999) count++;
    }
  }
  // B mask, S mask, generations C. Bit n = n neighbours.
  int B = 8, S = 12, C = 2;               // Conway B3/S23
  if (u_rule == 1) { B = 4; S = 0; C = 3; }          // Brian's Brain B2/S/C3
  else if (u_rule == 2) { B = 4; S = 56; C = 4; }    // Star Wars B2/S345/C4
  else if (u_rule == 3) { B = 456; S = 472; C = 2; } // Day & Night B3678/S34678
  else if (u_rule == 4) { B = 4; S = 0; C = 2; }     // Seeds B2/S
  else if (u_rule == 5) { B = 72; S = 120; C = 5; }  // Fireworks-like B36/S3456/C5

  float alive = s.r;
  float next;
  if (u_rule == 6) {
    // Larger than Life "Bosco": range 5, birth 34..45, survive 33..57.
    next = alive > 0.999 ? (count >= 33 && count <= 57 ? 1.0 : 0.0)
                         : (count >= 34 && count <= 45 ? 1.0 : 0.0);
  } else if (alive > 0.999) {
    next = inMask(S, count) ? 1.0 : (C > 2 ? 1.0 - 1.0 / float(C - 1) : 0.0);
  } else if (alive > 0.0) {
    // Dying: step down through refractory states; cannot be reborn meanwhile.
    next = max(alive - 1.0 / float(C - 1), 0.0);
    if (next < 1e-3) next = 0.0;
  } else {
    next = inMask(B, count) ? 1.0 : 0.0;
  }

  int brush = brushMode();
  if (brush == 1) next = step(0.6, hash12(gl_FragCoord.xy + u_frame));
  else if (brush == 2) next = 0.0;

  float glow = max(next > 0.999 ? 1.0 : 0.0, s.g * (1.0 - u_afterglow));
  outColor = vec4(next, glow, 0.0, 1.0);
}
