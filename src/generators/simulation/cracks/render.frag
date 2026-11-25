// Cracks drawn with a width that thins with the distance from their origin (soft edges from
// the neighbouring cells), optionally glowing; or the distance itself (for animated reveals).
float crackAt(ivec2 p, out float dist) {
  vec4 s = stateAt(p);
  dist = s.b;
  return s.r;
}

void main() {
  ivec2 p = ivec2(floor(v_uv * vec2(stateSize())));
  float best = 0.0;
  float bestDist = 1.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      float dist;
      float c = crackAt(p + ivec2(x, y), dist);
      if (c < 0.5) continue;
      float width = mix(u_width, u_width * 0.25, dist);
      float k = 1.0 - smoothstep(width * 0.5, width * 0.5 + 1.0, length(vec2(float(x), float(y))));
      if (k > best) {
        best = k;
        bestDist = dist;
      }
    }
  }
  if (u_view == 1) {
    outColor = vec4(vec3(best > 0.0 ? 1.0 - bestDist : 0.0), 1.0);
    return;
  }
  outColor = vec4(vec3(best * mix(1.0, 1.0 - bestDist * 0.5, u_fade)), 1.0);
}
