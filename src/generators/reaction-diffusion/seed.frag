// Initial state: A = 1 everywhere, B = 1 inside the seed shape. State layout: r = A, g = B.
in vec2 v_uv;
out vec4 outColor;

uniform float u_seed;
uniform int u_seedMode;
uniform sampler2D u_seedTexture;

#include <common>
#include <noise>

void main() {
  vec2 uv = v_uv;
  float b = 0.0;
  if (u_seedMode == 0) {
    // Center square
    b = step(max(abs(uv.x - 0.5), abs(uv.y - 0.5)), 0.04);
  } else if (u_seedMode == 1) {
    // Random spots on a jittered grid
    vec2 cell = floor(uv * 12.0);
    vec2 h = hash22(cell);
    vec2 center = (cell + 0.25 + 0.5 * h) / 12.0;
    b = step(hash12(cell + 9.1), 0.2) * step(length(uv - center), 0.018);
  } else if (u_seedMode == 2) {
    // Thresholded seamless noise
    b = step(0.25, gradientNoise(uv * 10.0, vec2(10.0), 0.0));
  } else if (u_seedMode == 3) {
    // Ring
    b = step(abs(length(uv - 0.5) - 0.25), 0.012);
  } else if (u_seedMode == 4) {
    // Rasterized text
    b = step(0.5, texture(u_seedTexture, uv).r);
  }
  outColor = vec4(1.0, b, 0.0, 1.0);
}
