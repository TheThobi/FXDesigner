// Imported image placed with a fit mode, zoom and offset. Colors are kept (the generator
// defaults to source color mode); the channel option turns it into a grayscale mask.
vec4 generate(vec2 uv) {
  vec2 size = u_imageSize;
  if (size.x <= 0.0) {
    // Nothing loaded yet: a discreet checker invites to load an image.
    vec2 c = floor(uv * 8.0);
    return vec4(vec3(0.12 + 0.06 * mod(c.x + c.y, 2.0)), 1.0);
  }
  float ratio = (size.x / size.y) / (u_resolution.x / u_resolution.y);
  vec2 p = uv;
  if (u_fit == 1) {
    p = uv * float(u_tiles);
  } else if (u_fit == 2 || u_fit == 3) {
    // Contain shows the whole image (letterbox); cover fills the frame (crop).
    bool wider = ratio > 1.0;
    bool contain = u_fit == 2;
    if (wider == contain) p.y = (uv.y - 0.5) * ratio + 0.5;
    else p.x = (uv.x - 0.5) / ratio + 0.5;
  }
  p = (p - 0.5) / max(u_zoom, 1e-3) + 0.5 - u_offset;
  bool tiled = u_fit == 1 || u_repeat;
  if (!tiled && (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0)) return vec4(0.0);
  vec4 c = texture(u_image, fract(p));
  if (u_channel == 1) return vec4(vec3(luminance(c.rgb)), c.a);
  if (u_channel == 2) return vec4(vec3(c.a), 1.0);
  return c;
}
