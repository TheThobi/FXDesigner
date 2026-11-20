// Slope blur, pass 1: the slope (height) map — periodic fBm or the image luminance.
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_source;

void main() {
  float h;
  if (u_slopeSource == 1) {
    h = dot(texture(u_source, v_uv).rgb, vec3(0.2126, 0.7152, 0.0722));
  } else {
    float s = max(1.0, floor(u_slopeScale + 0.5));
    h = 0.5 + 0.5 * fbm(v_uv * s, 5, 2.0, 0.5, vec2(s), 0.0, FBM_STANDARD);
  }
  outColor = vec4(h, h, h, 1.0);
}
