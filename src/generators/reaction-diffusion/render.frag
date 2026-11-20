// Visualizes the simulation state (manual bilinear filtering: float32 is not filterable).
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_state;
uniform int u_view;
uniform float u_gain;
uniform float u_lightAngle;
uniform float u_relief;

#include <common>

// p >= -1 here; adding size first keeps the modulo operands positive (negative % is undefined).
vec2 fetchWrapped(ivec2 p, ivec2 size) {
  return texelFetch(u_state, (p + size) % size, 0).rg;
}

vec2 sampleState(vec2 uv) {
  ivec2 size = textureSize(u_state, 0);
  vec2 p = uv * vec2(size) - 0.5;
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 a = fetchWrapped(i, size);
  vec2 b = fetchWrapped(i + ivec2(1, 0), size);
  vec2 c = fetchWrapped(i + ivec2(0, 1), size);
  vec2 d = fetchWrapped(i + ivec2(1, 1), size);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float valueAt(vec2 uv) {
  vec2 s = sampleState(uv);
  if (u_view == 1) return s.x;
  if (u_view == 2) return saturate((s.x - s.y) * u_gain - (u_gain - 1.0) * 0.5);
  return saturate(s.y * u_gain);
}

void main() {
  float v = valueAt(v_uv);
  if (u_view == 3) {
    // Embossed relief lit from u_lightAngle, height = B.
    vec2 texel = 1.0 / vec2(textureSize(u_state, 0));
    float hx = sampleState(v_uv + vec2(texel.x, 0.0)).y - sampleState(v_uv - vec2(texel.x, 0.0)).y;
    float hy = sampleState(v_uv + vec2(0.0, texel.y)).y - sampleState(v_uv - vec2(0.0, texel.y)).y;
    vec3 n = normalize(vec3(-hx * u_relief * 20.0, -hy * u_relief * 20.0, 1.0));
    float la = radians(u_lightAngle);
    vec3 l = normalize(vec3(cos(la), sin(la), 0.8));
    float b = saturate(sampleState(v_uv).y * u_gain);
    v = saturate(0.25 + 0.75 * dot(n, l)) * (0.35 + 0.65 * b);
  }
  outColor = vec4(vec3(v), 1.0);
}
