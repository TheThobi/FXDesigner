// Flood Fill, seed pass: every bright pixel of the Mask starts as an island of its own, its
// bounding box (xMin, yMin, xMax, yMax in pixels, relative to the pixel) empty; dark pixels
// (the lines between islands) get the sentinel OFF.
const float OFF = 1e6;

vec4 generate(vec2 uv) {
  vec4 m = texture(u_in_mask, uv);
  bool on = luminance(m.rgb) * m.a >= u_threshold;
  return on ? vec4(0.0) : vec4(OFF);
}
