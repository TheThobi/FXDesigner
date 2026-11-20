// Jones' Physarum agent: sense trail ahead / left / right, steer toward the strongest, move.
uniform sampler2D u_agents;
uniform sampler2D u_trail;

float sense(vec2 p) {
  ivec2 size = textureSize(u_trail, 0);
  ivec2 i = ivec2(floor(fract(p) * vec2(size)));
  return texelFetch(u_trail, i, 0).r;
}

vec2 dir(float a) { return vec2(cos(a), sin(a)); }

void main() {
  vec4 agent = texelFetch(u_agents, ivec2(gl_FragCoord.xy), 0);
  vec2 pos = agent.xy;
  float angle = agent.z;
  float texel = 1.0 / float(textureSize(u_trail, 0).x);
  float sa = radians(u_sensorAngle);
  float sd = u_sensorDistance * texel;
  float ta = radians(u_turnAngle);

  float f = sense(pos + dir(angle) * sd);
  float l = sense(pos + dir(angle + sa) * sd);
  float r = sense(pos + dir(angle - sa) * sd);
  float rnd = hash12(gl_FragCoord.xy + vec2(u_frame * 0.731, u_frame * 1.37));

  if (f > l && f > r) {
    // keep heading
  } else if (f < l && f < r) {
    angle += rnd < 0.5 ? ta : -ta;
  } else if (l > r) {
    angle += ta;
  } else if (r > l) {
    angle -= ta;
  }
  angle += (rnd - 0.5) * radians(u_wander);

  pos = fract(pos + dir(angle) * u_moveSpeed * texel);
  outColor = vec4(pos, mod(angle, TAU), 1.0);
}
