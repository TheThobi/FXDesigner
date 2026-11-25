// Burning paper step: burning cells consume their fuel; a cell catches fire with a chance
// that grows with its burning neighbours (more from upwind ones) and its fuel, so the front
// advances raggedly. Unburnt cells near the fire scorch first.
void main() {
  vec4 s = neighbor(0, 0);
  float burnt = s.r;
  float fire = s.g;
  float fuel = s.b;
  float scorch = s.a;
  float a = radians(u_windAngle);
  vec2 wind = vec2(cos(a), sin(a));
  float heat = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      if (x == 0 && y == 0) continue;
      vec2 o = vec2(float(x), float(y));
      // Fire travels from the neighbour toward this cell (-o): favoured downwind.
      float w = max(0.0, 1.0 + u_wind * 1.5 * dot(-normalize(o), wind)) / length(o);
      heat += neighbor(x, y).g * w;
    }
  }
  heat /= 8.0;
  if (fire > 0.5) {
    burnt += u_burnSpeed * 0.02 / max(fuel, 0.2);
    if (burnt >= 1.0) {
      burnt = 1.0;
      fire = 0.0;
    }
  } else if (burnt < 0.01 && fuel > 0.05) {
    scorch = min(1.0, scorch + heat * 0.08);
    float chance = u_spread * heat * fuel;
    if (hash12(floor(gl_FragCoord.xy) + fract(u_frame * 0.0137) * 911.0) < chance) fire = 1.0;
  }
  if (u_has_ignite && burnt < 0.01 && fuel > 0.05) {
    vec4 ig = texture(u_in_ignite, v_uv);
    if (luminance(ig.rgb) * ig.a > 0.5) fire = 1.0;
  }
  int brush = brushMode();
  if (brush == 1 && burnt < 0.99 && fuel > 0.05) fire = 1.0;
  else if (brush == 2) fire = 0.0;
  outColor = vec4(burnt, fire, fuel, scorch);
}
