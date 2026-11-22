// Paint mask: strokes accumulate and stay (optional fade). The brush is a capsule from the
// previous pointer position to the current one, so fast strokes stay continuous.
void main() {
  float v = neighbor(0, 0).r * (1.0 - u_fade * 0.01);
  if (u_brush.w > 0.5) {
    vec2 a = u_brush.xy - u_brushDir;
    vec2 b = u_brush.xy;
    vec2 pa = brushDelta(v_uv, a);
    vec2 ba = (b - a) * brushScale();
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    float r = length(pa - ba * h) / max(u_brush.z, 1e-4);
    float k = (1.0 - smoothstep(u_hardness, 1.0, r)) * u_strength;
    if (u_brush.w < 1.5) v += (1.0 - v) * k;
    else v *= 1.0 - k;
  }
  outColor = vec4(saturate(v), 0.0, 0.0, 1.0);
}
