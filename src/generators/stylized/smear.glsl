// Smear frame: a dry-brush arc as drawn in animation smears. Solid at the head, splitting
// into bristle streaks that break up toward the tail.
vec4 generate(vec2 uv) {
  vec2 p = rotate2d(centered(uv), radians(u_rotation));
  float t = u_time * u_speed;
  float r = length(p);
  float a = atan(p.y, p.x);
  float along = (a + PI) / radians(u_arc); // 0 = head, 1 = tail end
  if (along > 1.0) return vec4(0.0);
  float head = 1.0 - along;
  float w = u_thickness * 0.5 * pow(max(head, 0.0), u_taper) + 1e-4;
  float radial = (r - u_radius) / w; // -1..1 across the stroke
  float aa = 3.0 / (u_resolution.x * w);
  float band = 1.0 - smoothstep(1.0 - aa, 1.0, abs(radial));
  float across = radial * 0.5 + 0.5;
  float lineId = floor(across * float(u_lines));
  float wobble = fbm(vec2(along * 3.0 - t, lineId * 0.37), 2) * 0.3;
  float lineF = fract(across * float(u_lines) + wobble);
  float bristle = smoothstep(0.0, 0.2, lineF) * smoothstep(1.0, 0.8, lineF);
  float cut = hash12(vec2(lineId, 3.0)) * 0.8 + 0.2;
  float dry = 1.0 - smoothstep(cut - 0.1, cut + 0.05, along * u_breakup * 1.4);
  float solid = smoothstep(u_breakup * 0.6, 0.0, along);
  float v = band * max(solid, bristle * dry);
  return vec4(vec3(v), v);
}
