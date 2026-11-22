// Flowmap painting: the brush blends the field toward the stroke direction with a soft
// falloff; erase blends toward zero. Optional relaxation smooths the field over time.
void main() {
  vec2 f = neighbor(0, 0).rg;
  if (u_relax > 0.0) f = mix(f, boxAverage().rg, u_relax * 0.25);

  if (u_brush.w > 0.5) {
    vec2 d = brushDelta(v_uv, u_brush.xy);
    float r = u_brush.z;
    float falloff = 1.0 - smoothstep(r * (1.0 - u_brushSoftness), r, length(d));
    float amount = falloff * u_brushOpacity * 0.25;
    if (u_brush.w < 1.5) {
      float speed = length(u_brushDir);
      if (speed > 1e-5) f = mix(f, u_brushDir / speed * u_brushStrength, amount);
    } else {
      f = mix(f, vec2(0.0), amount);
    }
  }
  outColor = vec4(clamp(f, -1.0, 1.0), 0.0, 1.0);
}
