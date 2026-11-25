// Burning paper views. Composite: paper (darkened where scorched), a dark charred band
// behind a bright ember line, then a hole (transparent) or ash. Alpha = paper left.
void main() {
  vec4 s = sampleState(v_uv);
  float burnt = s.r;
  float fire = s.g;
  float fuel = s.b;
  float scorch = s.a;
  if (u_view == 1) {
    outColor = vec4(vec3(fuel > 0.05 ? burnt : 1.0), 1.0);
    return;
  }
  if (u_view == 2) {
    outColor = vec4(vec3(fire * (1.0 - burnt)), 1.0);
    return;
  }
  float present = smoothstep(0.02, 0.08, fuel);
  float paper = (0.55 + 0.2 * fuel) * (1.0 - 0.75 * scorch);
  float charred = mix(paper, 0.08, smoothstep(0.0, 0.25, burnt));
  float ember = fire * (1.0 - smoothstep(0.0, 0.6, burnt));
  float tone = max(charred, ember);
  float gone = smoothstep(0.85, 1.0, burnt);
  float alpha = present * (u_holes ? 1.0 - gone : 1.0);
  if (!u_holes) tone = mix(tone, 0.18, gone);
  outColor = vec4(vec3(tone), alpha);
}
