// Jones' Physarum agent: sense trail ahead / left / right, steer toward the strongest, move.
// Several species: each has its own trail channel (R, G, B); an agent follows its own and
// avoids the others' (weighted by Repulsion).
uniform sampler2D u_agents;
uniform sampler2D u_trail;

vec3 g_weights;

float sense(vec2 p) {
  ivec2 size = textureSize(u_trail, 0);
  ivec2 i = ivec2(floor(fract(p) * vec2(size)));
  return dot(texelFetch(u_trail, i, 0).rgb, g_weights);
}

vec2 dir(float a) { return vec2(cos(a), sin(a)); }

void main() {
  ivec2 id = ivec2(gl_FragCoord.xy);
  int species = (id.x + id.y * textureSize(u_agents, 0).x) % max(u_species, 1);
  vec3 own = vec3(species == 0, species == 1, species == 2);
  g_weights = own - (1.0 - own) * u_repulsion;
  vec4 agent = texelFetch(u_agents, id, 0);
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
