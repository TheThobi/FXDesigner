// One channel of a node's image as an opaque grayscale (channel outputs, e.g. Unpack RGBA).
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_source;
uniform int u_channel;

void main() {
  vec4 c = texture(u_source, v_uv);
  float v = u_channel == 0 ? c.r : u_channel == 1 ? c.g : u_channel == 2 ? c.b : c.a;
  outColor = vec4(vec3(v), 1.0);
}
