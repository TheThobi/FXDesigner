// Additively blended trail deposit, into the agent's species channel.
flat in int v_species;

void main() {
  outColor = vec4(vec3(v_species == 0, v_species == 1, v_species == 2) * u_deposit, 0.0);
}
