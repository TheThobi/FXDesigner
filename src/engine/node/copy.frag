// Plain resampling copy (Post Process bypassed: the node outputs its raw source).
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_source;

void main() {
  outColor = texture(u_source, v_uv);
}
