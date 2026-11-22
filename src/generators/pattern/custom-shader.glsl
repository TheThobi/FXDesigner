// Custom Shader: write your own generator. Edit this code in the Code view of the node.
// uv is in [0, 1] (y up). Return grayscale in rgb (the Post Process colorizes it) and the
// coverage in alpha. u_a .. u_d are the four sliders of the node, u_color its color.
//
// Animation: u_time is the time in seconds (timeline). Multiply it by a speed and feed it to
// positions, angles or noise offsets. Turn on Seamless in the timeline to export a looping
// flipbook: the engine blends the end of the loop into its start.

vec4 generate(vec2 uv) {
  vec2 p = centered(uv);                          // -1..1 around the center
  float t = u_time * u_speed;                     // animated time

  // Pulse: the ring radius breathes with a sine of the time.
  float radius = u_a * (1.0 + 0.15 * sin(t * TAU * 0.5));

  // Swirl: rotate the noise lookup around the center as time goes by.
  float angle = atan(p.y, p.x) + t * 0.6;
  vec2 q = vec2(cos(angle), sin(angle)) * length(p);
  float n = fbm(q * (2.0 + u_b * 10.0) + vec2(0.0, t * 0.4), 5);

  float ring = abs(length(p) - radius) - 0.02 - 0.1 * n * u_c;
  float v = smoothstep(0.02, 0.0, ring) + u_d * n;
  return vec4(vec3(v) * u_color, clamp(v, 0.0, 1.0));
}
