// Trail diffusion (3x3 blur) and decay; the brush paints attractant or clears.
uniform sampler2D u_trail;

void main() {
  ivec2 size = textureSize(u_trail, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  float center = texelFetch(u_trail, p, 0).r;
  float sum = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++)
      sum += texelFetch(u_trail, (p + ivec2(x, y) + size) % size, 0).r;
  float v = mix(center, sum / 9.0, u_diffuse) * (1.0 - u_decay);
  int brush = brushMode();
  if (brush == 1) v += 2.0;
  else if (brush == 2) v = 0.0;
  outColor = vec4(min(v, 100.0), 0.0, 0.0, 1.0);
}
