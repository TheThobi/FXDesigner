// Trail diffusion (3x3 blur) and decay; the brush paints attractant or clears; the Food input
// keeps emitting attractant where it is bright.
uniform sampler2D u_trail;

void main() {
  ivec2 size = textureSize(u_trail, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 center = texelFetch(u_trail, p, 0).rgb;
  vec3 sum = vec3(0.0);
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++)
      sum += texelFetch(u_trail, (p + ivec2(x, y) + size) % size, 0).rgb;
  vec3 v = mix(center, sum / 9.0, u_diffuse) * (1.0 - u_decay);
  if (u_has_food) {
    vec4 food = texture(u_in_food, (vec2(p) + 0.5) / vec2(size));
    v += luminance(food.rgb) * food.a * u_foodStrength;
  }
  int brush = brushMode();
  if (brush == 1) v += 2.0;
  else if (brush == 2) v = vec3(0.0);
  outColor = vec4(min(v, vec3(100.0)), 1.0);
}
