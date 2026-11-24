// 3D preview geometry built from gl_VertexID (no buffers): u_segments² quads per face of a
// plane (0), sphere (1), cube (2, six faces) or cylinder (3). Outputs the surface frame for
// normal mapping.
uniform mat4 u_viewProj;
uniform int u_shape;
uniform int u_segments;

out vec3 v_pos;
out vec3 v_normal;
out vec3 v_tangent;
out vec3 v_bitangent;
out vec2 v_uv;

const float PI = 3.14159265;
const vec2 CORNERS[6] = vec2[6](vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 0), vec2(1, 1), vec2(0, 1));

void main() {
  int n = u_segments;
  int quad = gl_VertexID / 6;
  int face = quad / (n * n);
  int cell = quad - face * n * n;
  vec2 g = (vec2(float(cell % n), float(cell / n)) + CORNERS[gl_VertexID % 6]) / float(n);
  vec3 p;
  vec3 nrm;
  vec3 t;
  vec3 b;
  vec2 uv = g;
  if (u_shape == 1) {
    float theta = g.x * 2.0 * PI;
    float lat = (g.y - 0.5) * PI;
    p = vec3(cos(lat) * sin(theta), sin(lat), cos(lat) * cos(theta));
    nrm = p;
    t = vec3(cos(theta), 0.0, -sin(theta));
    b = vec3(-sin(lat) * sin(theta), cos(lat), -sin(lat) * cos(theta));
    uv = vec2(g.x * 2.0, g.y); // 2:1 around the equator keeps texels square
  } else if (u_shape == 2) {
    vec3 normals[6] = vec3[6](vec3(0, 0, 1), vec3(1, 0, 0), vec3(0, 0, -1), vec3(-1, 0, 0), vec3(0, 1, 0), vec3(0, -1, 0));
    vec3 tangents[6] = vec3[6](vec3(1, 0, 0), vec3(0, 0, -1), vec3(-1, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), vec3(1, 0, 0));
    nrm = normals[face];
    t = tangents[face];
    b = cross(nrm, t);
    p = (nrm + (g.x * 2.0 - 1.0) * t + (g.y * 2.0 - 1.0) * b) * 0.8;
  } else if (u_shape == 3) {
    float theta = g.x * 2.0 * PI;
    nrm = vec3(sin(theta), 0.0, cos(theta));
    p = vec3(nrm.x, g.y * 2.0 - 1.0, nrm.z) * vec3(0.8, 1.0, 0.8);
    t = vec3(cos(theta), 0.0, -sin(theta));
    b = vec3(0.0, 1.0, 0.0);
    uv = vec2(g.x * 3.0, g.y * 1.2);
  } else {
    p = vec3(g * 2.0 - 1.0, 0.0);
    nrm = vec3(0.0, 0.0, 1.0);
    t = vec3(1.0, 0.0, 0.0);
    b = vec3(0.0, 1.0, 0.0);
  }
  v_pos = p;
  v_normal = nrm;
  v_tangent = t;
  v_bitangent = b;
  v_uv = uv;
  gl_Position = u_viewProj * vec4(p, 1.0);
}
