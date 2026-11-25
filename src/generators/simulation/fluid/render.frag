// Dye density (ink), velocity magnitude, or curl (vortices) for stylized swirls.
void main() {
  vec4 s = sampleState(v_uv);
  float v;
  if (u_view == 0) v = s.a;
  else if (u_view == 1) v = clamp(length(s.rg) * 0.5, 0.0, 1.0);
  else {
    vec2 e = 1.0 / vec2(stateSize());
    float curl = (sampleState(v_uv + vec2(e.x, 0.0)).g - sampleState(v_uv - vec2(e.x, 0.0)).g) -
                 (sampleState(v_uv + vec2(0.0, e.y)).r - sampleState(v_uv - vec2(0.0, e.y)).r);
    v = 0.5 + curl * 2.0;
  }
  // Ink contrast: sharpen the dye into crisp, painterly fronts.
  v = smoothstep(0.5 - 0.5 / u_inkContrast, 0.5 + 0.5 / u_inkContrast, v);
  if (u_colorInk && u_view == 0) {
    // Colored inks: the mixed hue carried with the dye, at the sharpened density.
    vec3 ink = sampleState2(v_uv).rgb / max(s.a, 1e-4);
    outColor = vec4(clamp(ink, 0.0, 1.0) * v, 1.0);
    return;
  }
  outColor = vec4(vec3(v), 1.0);
}
