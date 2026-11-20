// Initial flow field (rg = flow vector in [-1, 1]).
void main() {
  vec2 f = vec2(0.0);
  vec2 rel = v_uv - 0.5;
  if (u_initial == 1) {
    float a = radians(u_baseAngle);
    f = vec2(cos(a), sin(a));
  } else if (u_initial == 2) {
    f = normalize(vec2(-rel.y, rel.x) + 1e-5) * smoothstep(0.0, 0.1, length(rel));
  } else if (u_initial == 3) {
    vec2 c = curlNoise(v_uv * 3.0, vec2(3.0), 0.0, 3);
    f = c / max(length(c), 1e-4);
  }
  outColor = vec4(f * u_baseStrength, 0.0, 1.0);
}
