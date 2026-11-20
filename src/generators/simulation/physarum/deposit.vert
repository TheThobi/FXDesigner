#version 300 es
// One point per agent, positioned from the agent texture.
precision highp float;
precision highp int;
uniform sampler2D u_agents;
out vec2 v_uv; // consumed by the shared simulation fragment prelude

void main() {
  int res = textureSize(u_agents, 0).x;
  vec2 pos = texelFetch(u_agents, ivec2(gl_VertexID % res, gl_VertexID / res), 0).xy;
  v_uv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}
