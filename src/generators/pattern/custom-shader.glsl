// Custom Shader: write your own generator. Edit this code in the Code view of the node.
// uv is in [0, 1] (y up). Return grayscale in rgb (the Post Process colorizes it) and the
// coverage in alpha. u_a .. u_d are the four sliders of the node, u_color its color.

vec4 generate(vec2 uv) {
  vec2 p = centered(uv);                       // -1..1 around the center
  float n = fbm(uv * (2.0 + u_b * 10.0), 5);   // tileable fractal noise
  float ring = abs(length(p) - u_a) - 0.02 - 0.1 * n * u_c;
  float v = smoothstep(0.02, 0.0, ring) + u_d * n;
  return vec4(vec3(v) * u_color, clamp(v, 0.0, 1.0));
}
