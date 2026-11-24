// Shared by the fluid passes (Ink Fluid, Smoke & Fire): requires an `obstacles` input.
bool solidAt(int dx, int dy) {
  if (!u_has_obstacles) return false;
  vec2 uv = (floor(gl_FragCoord.xy) + vec2(float(dx), float(dy)) + 0.5) / u_gridSize;
  vec4 c = texture(u_in_obstacles, uv);
  return luminance(c.rgb) * c.a > 0.5;
}
