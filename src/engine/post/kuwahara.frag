// Generalized Kuwahara filter (after Papari et al. 2007, 4 sectors): each output pixel takes
// the mean of its neighbourhood quadrants, weighted towards the most uniform ones. Flattens
// texture into painterly patches while keeping edges crisp. Seamless (repeat wrap).
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_source;
uniform float u_radius;   // uv

const int N = 4;          // samples per quadrant side: (N+1)^2 taps per quadrant

void main() {
  vec2 offsets[4] = vec2[4](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0));
  float stepUv = u_radius / float(N);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int q = 0; q < 4; q++) {
    vec4 m = vec4(0.0);
    vec3 m2 = vec3(0.0);
    for (int y = 0; y <= N; y++) {
      for (int x = 0; x <= N; x++) {
        vec4 s = texture(u_source, v_uv + offsets[q] * vec2(float(x), float(y)) * stepUv);
        m += s;
        m2 += s.rgb * s.rgb;
      }
    }
    float count = float((N + 1) * (N + 1));
    m /= count;
    vec3 variance = max(m2 / count - m.rgb * m.rgb, 0.0);
    float sigma = (variance.r + variance.g + variance.b) * 60.0;
    float w = 1.0 / (1e-4 + pow(sigma, u_kuwaharaSharpness * 0.5));
    acc += m * w;
    wsum += w;
  }
  outColor = acc / wsum;
}
