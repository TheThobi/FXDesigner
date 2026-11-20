// Live cells, dying states and the fading history ("afterglow") as gray levels.
void main() {
  vec2 cellUv = (floor(v_uv * vec2(stateSize())) + 0.5) / vec2(stateSize());
  vec4 s = texture(u_state, u_crisp ? cellUv : v_uv);
  float alive = s.r > 0.999 ? 1.0 : 0.0;
  float dying = s.r < 0.999 ? s.r * 0.7 : 0.0;
  float v = max(max(alive, dying), s.g * u_history);
  outColor = vec4(vec3(v), 1.0);
}
