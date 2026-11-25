// Crack growth. State: r = cracked, g = heading of a tip (fraction of a turn), b = distance
// from the origin (0 at the impact, 1 = Length), a = 1 on growing tips.
void main() {
  vec2 p = floor(gl_FragCoord.xy);
  vec2 center = floor(u_gridSize * 0.5);
  vec2 d = p - center;
  float r = length(d);
  float n = float(u_branches);
  if (u_start == 0) {
    // Impact: tips on a small ring around the center, heading outward, n directions.
    float a = atan(d.y, d.x);
    float k = floor((a / TAU + 0.5) * n + 0.5);
    float target = (k / n - 0.5) * TAU + (hash12(vec2(k, 2.0)) - 0.5) * 0.6;
    vec2 tip = floor(center + vec2(cos(target), sin(target)) * 2.0 + 0.5);
    if (all(equal(p, tip))) {
      outColor = vec4(1.0, fract(target / TAU), 0.0, 1.0);
      return;
    }
    outColor = vec4(step(r, 1.5), 0.0, 0.0, 0.0);
    return;
  }
  // Random starts: a few tips anywhere, random headings.
  float h = hash12(p + 7.0);
  float count = n * 0.5;
  bool tip = h < count / (u_gridSize.x * u_gridSize.y);
  outColor = tip ? vec4(1.0, hash12(p + 3.1), 0.0, 1.0) : vec4(0.0);
}
