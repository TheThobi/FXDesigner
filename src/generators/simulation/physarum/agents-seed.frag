// Spawns agents: r,g = position (uv), b = heading (radians).
void main() {
  vec2 id = floor(gl_FragCoord.xy);
  float h1 = hash12(id), h2 = hash12(id + 17.3), h3 = hash12(id + 41.9);
  vec2 pos;
  float angle;
  if (u_spawn == 0) {            // uniform, random headings
    pos = vec2(h1, h2);
    angle = h3 * TAU;
  } else if (u_spawn == 1) {     // disc, facing outward
    float a = h1 * TAU, r = sqrt(h2) * 0.3;
    pos = 0.5 + r * vec2(cos(a), sin(a));
    angle = a;
  } else {                       // ring, facing inward
    float a = h1 * TAU, r = 0.35 + 0.02 * h2;
    pos = 0.5 + r * vec2(cos(a), sin(a));
    angle = a + PI;
  }
  outColor = vec4(pos, angle, 1.0);
}
