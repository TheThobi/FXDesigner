// One explicit Euler step of the Gray-Scott model (Karl Sims' formulation):
//   A' = A + (dA * lap(A) - A*B*B + f * (1 - A)) * dt
//   B' = B + (dB * lap(B) + A*B*B - (k + f) * B) * dt
// Laplacian: 3x3 convolution, center -1, edges 0.2, corners 0.05, toroidal wrap (seamless),
// plus an optional anisotropic diffusion-tensor term (direction phi, strength u_anisotropy).
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_state;
uniform float u_feed;
uniform float u_kill;
uniform float u_diffA;
uniform float u_diffB;
uniform float u_dt;
uniform int u_mapMode;
uniform float u_feedSpread;
uniform float u_killSpread;
uniform float u_anisotropy;
uniform int u_directionMode;
uniform float u_direction;
uniform vec4 u_brush; // xy = uv, z = radius, w = 0 off / 1 paint / 2 erase

#include <common>

ivec2 g_size;
ivec2 g_pos;

vec2 at(int dx, int dy) {
  return texelFetch(u_state, (g_pos + ivec2(dx, dy) + g_size) % g_size, 0).rg;
}

void main() {
  g_size = textureSize(u_state, 0);
  g_pos = ivec2(gl_FragCoord.xy);
  vec2 c = at(0, 0);

  vec2 rel = v_uv - 0.5;
  float phi = radians(u_direction);
  if (u_directionMode == 1) phi = atan(rel.y, rel.x) + PI * 0.5; // swirl
  else if (u_directionMode == 2) phi = atan(rel.y, rel.x);       // radial

  // Isotropic part: Karl Sims' stencil (≈ 0.3 · h²∇²).
  vec2 n = at(0, 1), so = at(0, -1), e = at(1, 0), w = at(-1, 0);
  vec2 ne = at(1, 1), nw = at(-1, 1), se = at(1, -1), sw = at(-1, -1);
  vec2 lap = 0.2 * (n + so + e + w) + 0.05 * (ne + nw + se + sw) - c;

  // Anisotropic part: div(D grad u) with D = I + a [cos2φ sin2φ; sin2φ -cos2φ], i.e.
  //   a (cos2φ (u_xx - u_yy) + 2 sin2φ u_xy), scaled like the isotropic stencil (0.3).
  // The worst-case stencil eigenvalue grows from 1.6 (isotropic, checkerboard mode) to
  // 1.2 (1 + a) (stripe mode along phi); dt is scaled below to keep the isotropic margin.
  if (u_anisotropy > 0.0) {
    vec2 uxxMinusUyy = (e + w) - (n + so);
    vec2 uxy = 0.25 * ((ne + sw) - (nw + se));
    lap += 0.3 * u_anisotropy * (cos(2.0 * phi) * uxxMinusUyy + 2.0 * sin(2.0 * phi) * uxy);
  }

  float f = u_feed;
  float k = u_kill;
  if (u_mapMode == 1) {
    f += u_feedSpread * (v_uv.x * 2.0 - 1.0);
    k += u_killSpread * (v_uv.y * 2.0 - 1.0);
  } else if (u_mapMode == 2) {
    float r = saturate(length(rel) * 2.0) * 2.0 - 1.0;
    f += u_feedSpread * r;
    k += u_killSpread * r;
  }

  float dt = u_dt * min(1.0, 1.6 / (1.2 * (1.0 + u_anisotropy)));
  float a = c.x;
  float b = c.y;
  float reaction = a * b * b;
  a += (u_diffA * lap.x - reaction + f * (1.0 - a)) * dt;
  b += (u_diffB * lap.y + reaction - (k + f) * b) * dt;

  if (u_brush.w > 0.0) {
    vec2 d = abs(v_uv - u_brush.xy);
    d = min(d, 1.0 - d); // brush wraps around edges too
    if (length(d) < u_brush.z) {
      if (u_brush.w < 1.5) { b = 1.0; } else { a = 1.0; b = 0.0; }
    }
  }

  outColor = vec4(saturate(a), saturate(b), 0.0, 1.0);
}
