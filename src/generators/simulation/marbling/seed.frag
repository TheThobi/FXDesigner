// Initial ink layout, value in r. All patterns are periodic so the result tiles.
void main() {
  vec2 uv = v_uv;
  float bands = float(u_bands);
  float v;
  if (u_pattern == 0) {
    v = fract(uv.y * bands);                                  // horizontal stripes
  } else if (u_pattern == 1) {
    vec2 d = abs(fract(uv * 2.0) - 0.5);                      // concentric rings (suminagashi)
    v = fract(length(d) * bands);
  } else if (u_pattern == 2) {
    vec2 c = floor(uv * bands);                               // checker
    v = mod(c.x + c.y, 2.0) * 0.5 + 0.25 * mod(c.x, 2.0);
  } else {
    v = fract(gradientNoise(uv * 4.0, vec2(4.0), 0.0) * bands * 0.5); // noise contours
  }
  // Seed input (any node, e.g. an Image): marble that picture instead.
  if (u_has_seed) {
    vec4 c = texture(u_in_seed, uv);
    v = luminance(c.rgb) * c.a;
  }
  outColor = vec4(v, 0.0, 0.0, 1.0);
}
