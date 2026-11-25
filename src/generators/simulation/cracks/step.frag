// Crack growth step: every tip extends into the neighbour cell its heading points to (the
// heading wanders a little), sometimes into a second one at an angle (branch), then stops
// being a tip. Cracks never cross: a tip dies on an existing crack, on hard material, at full
// length, or at random.
float wander(vec2 cell) {
  return (hash12(cell + fract(u_frame * 0.0173) * 431.0) - 0.5) * u_wiggle;
}

void main() {
  vec4 s = neighbor(0, 0);
  if (s.r > 0.5) {
    outColor = vec4(s.rgb, 0.0); // a tip grows once
    return;
  }
  vec2 self = floor(gl_FragCoord.xy);
  float hard = 0.0;
  if (u_has_hardness) {
    vec4 hc = texture(u_in_hardness, v_uv);
    hard = luminance(hc.rgb) * hc.a;
  }
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      if (x == 0 && y == 0) continue;
      vec4 n = neighbor(x, y);
      if (n.a < 0.5 || n.b >= 1.0) continue;
      vec2 cell = self + vec2(float(x), float(y));
      if (hash12(cell + 11.0 + fract(u_frame * 0.031) * 97.0) < u_stop * 0.01 + hard * 0.5) continue;
      // The parent extends into the neighbour of its heading's octant, and a branch into the
      // next octant now and then.
      float heading = n.g * TAU;
      float octant = floor(heading / (TAU / 8.0) + 0.5);
      vec2 toMe = -vec2(float(x), float(y));
      vec2 straight = floor(vec2(cos(octant * TAU / 8.0), sin(octant * TAU / 8.0)) + 0.5);
      float side = hash12(cell + 5.0) < 0.5 ? 1.0 : -1.0;
      float bo = octant + side;
      vec2 fork = floor(vec2(cos(bo * TAU / 8.0), sin(bo * TAU / 8.0)) + 0.5);
      bool isMain = all(equal(toMe, straight));
      bool isFork = !isMain && all(equal(toMe, fork)) &&
                    hash12(cell + fract(u_frame * 0.011) * 53.0) < u_branching * 0.05;
      if (isMain || isFork) {
        float h = (isFork ? heading + side * TAU / 8.0 : heading) + wander(cell);
        float dist = n.b + 1.0 / max(u_length * min(u_gridSize.x, u_gridSize.y), 1.0);
        outColor = vec4(1.0, fract(h / TAU), dist, 1.0);
        return;
      }
    }
  }
  int brush = brushMode();
  if (brush == 1) {
    outColor = vec4(1.0, hash12(self + u_frame), 0.0, 1.0);
    return;
  }
  outColor = vec4(0.0);
}
