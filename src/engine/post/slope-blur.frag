// Slope blur, pass 2 (after Substance Designer's node): walks from each pixel along the
// gradient of the slope map, accumulating the source (average, min or max). Smears colors
// along flowing directions — a painterly smoothing of the image in UV space. Seamless.
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_source;
uniform sampler2D u_slope;
uniform float u_texel;      // slope map texel (uv)
uniform float u_distance;   // total walk length (uv)

vec2 slopeDir(vec2 uv) {
  vec2 g = vec2(texture(u_slope, uv + vec2(u_texel, 0.0)).r - texture(u_slope, uv - vec2(u_texel, 0.0)).r,
                texture(u_slope, uv + vec2(0.0, u_texel)).r - texture(u_slope, uv - vec2(0.0, u_texel)).r);
  float l = length(g);
  return l > 1e-6 ? g / l : vec2(0.0);
}

void main() {
  vec2 p = v_uv;
  vec4 first = texture(u_source, p);
  vec4 sum = first;
  vec4 lo = first;
  vec4 hi = first;
  float stepLen = u_distance / float(u_slopeSamples);
  for (int i = 0; i < 32; i++) {
    if (i >= u_slopeSamples) break;
    p += slopeDir(p) * stepLen;
    vec4 s = texture(u_source, p);
    sum += s;
    lo = min(lo, s);
    hi = max(hi, s);
  }
  outColor = u_slopeMode == 1 ? lo : u_slopeMode == 2 ? hi : sum / float(u_slopeSamples + 1);
}
