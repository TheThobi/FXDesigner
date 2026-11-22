// Tone-maps the (unbounded) trail density to [0, 1]: grayscale for one species, one RGB
// channel per species otherwise.
uniform sampler2D u_trail;

void main() {
  vec3 t = 1.0 - exp(-texture(u_trail, v_uv).rgb * u_gain);
  outColor = vec4(u_species <= 1 ? vec3(t.r) : t, 1.0);
}
