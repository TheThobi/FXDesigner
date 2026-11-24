// Anti-aliased capsule around the segment (blended with MAX: overlaps stay flat).
in vec2 v_local;
in float v_length;
out vec4 outColor;

uniform float u_halfWidth;

void main() {
  float dx = max(max(-v_local.x, v_local.x - v_length), 0.0);
  float d = length(vec2(dx, v_local.y));
  float a = 1.0 - smoothstep(u_halfWidth - 0.5, u_halfWidth + 0.5, d);
  outColor = vec4(a);
}
