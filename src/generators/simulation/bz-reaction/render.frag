void main() {
  vec3 c = sampleState(v_uv).rgb;
  vec3 v = u_view == 0 ? vec3(c.r) : u_view == 1 ? vec3(c.g) : u_view == 2 ? vec3(c.b) : c;
  outColor = vec4(v, 1.0);
}
