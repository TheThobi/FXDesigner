// Veined patterns: marble (turbulent sine), wood rings, agate contour bands.
// Thin dark veins come from |sin|^(1/sharpness).
float veins(float x) { return pow(abs(sin(PI * x)), 1.0 / u_sharpness); }

vec4 generate(vec2 uv) {
  float scale = max(1.0, floor(u_scale + 0.5));
  vec2 period = vec2(scale);
  float t = loopFlow(u_speed);
  float n = fbm(uv * scale, u_octaves, 2.0, 0.5, period, t, FBM_TURBULENCE);
  float bands = float(u_bands);
  float v;
  if (u_pattern == 0) {
    // Marble: integer slant keeps it seamless.
    v = veins((uv.x + uv.y * float(u_slant)) * bands + n * u_distortion);
  } else if (u_pattern == 1) {
    // Wood rings around a center (not seamless), elongated along Y.
    vec2 c = (centered(uv) - u_center) * vec2(1.0, u_stretch);
    v = veins(length(c) * bands + n * u_distortion * 0.3);
  } else {
    // Agate: contour bands of a smooth fBm.
    float h = fbm(uv * scale, u_octaves, 2.0, 0.5, period, t, FBM_STANDARD);
    v = veins(h * bands + n * u_distortion * 0.2);
  }
  return vec4(vec3(v), 1.0);
}
