// Tone-maps the (unbounded) trail density to [0, 1].
uniform sampler2D u_trail;

void main() {
  float t = texture(u_trail, v_uv).r;
  outColor = vec4(vec3(1.0 - exp(-t * u_gain)), 1.0);
}
