// Draws a node output (straight alpha) into its card on the viewport canvas, over a
// checkerboard, optionally tiled N×N. Output is opaque (premultiplied canvas).
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_source;
uniform float u_tiles;
uniform bool u_nearest;
uniform float u_checker;   // checker cell size in device pixels
uniform float u_dim;       // 0..1 darkening (unselected nodes)
uniform int u_channel;     // -1: the image; 0-3: one channel; 4: opaque RGB; 5: RG

void main() {
  vec2 uv = fract(v_uv * u_tiles);
  vec4 c;
  if (u_nearest) {
    ivec2 size = textureSize(u_source, 0);
    c = texelFetch(u_source, clamp(ivec2(uv * vec2(size)), ivec2(0), size - 1), 0);
  } else {
    c = texture(u_source, uv);
  }
  if (u_channel == 4) c.a = 1.0;
  else if (u_channel == 5) c = vec4(c.rg, 0.0, 1.0);
  else if (u_channel >= 0) c = vec4(vec3(c[u_channel]), 1.0);
  vec2 cell = floor(gl_FragCoord.xy / u_checker);
  float k = mod(cell.x + cell.y, 2.0);
  vec3 bg = mix(vec3(0.16), vec3(0.22), k);
  vec3 rgb = mix(bg, clamp(c.rgb, 0.0, 1.0), clamp(c.a, 0.0, 1.0));
  outColor = vec4(rgb * (1.0 - u_dim), 1.0);
}
