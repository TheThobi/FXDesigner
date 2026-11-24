// Differential growth: one instance per segment. Each texel holds a segment's start and end
// (uv, already unwrapped; segments crossing an edge come with shifted copies, see upload()).
// The segment becomes a pixel-space quad around it.
uniform sampler2D u_nodes;
uniform int u_width;
uniform vec2 u_size;      // target size (px)
uniform float u_halfWidth; // half line width (px)

out vec2 v_local;
out float v_length;

const vec2 CORNERS[6] = vec2[6](vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 0), vec2(1, 1), vec2(0, 1));

void main() {
  int seg = gl_InstanceID;
  vec4 n = texelFetch(u_nodes, ivec2(seg % u_width, seg / u_width), 0);
  vec2 a = n.xy * u_size;
  vec2 b = n.zw * u_size;
  float len = length(b - a);
  vec2 dir = len > 1e-4 ? (b - a) / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float margin = u_halfWidth + 1.0;
  vec2 c = CORNERS[gl_VertexID];
  float t = mix(-margin, len + margin, c.x);
  float s = mix(-margin, margin, c.y);
  v_local = vec2(t, s);
  v_length = len;
  vec2 p = a + dir * t + nrm * s;
  gl_Position = vec4(p / u_size * 2.0 - 1.0, 0.0, 1.0);
}
