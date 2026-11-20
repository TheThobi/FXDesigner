// One explicit Euler step of the Gray-Scott model (Karl Sims' formulation):
//   A' = A + (dA * lap(A) - A*B*B + f * (1 - A)) * dt
//   B' = B + (dB * lap(B) + A*B*B - (k + f) * B) * dt
// Laplacian: 3x3 convolution, center -1, edges 0.2, corners 0.05, toroidal wrap (seamless),
// plus an optional anisotropic diffusion-tensor term (direction phi, strength u_anisotropy).
void main() {
  vec2 c = neighbor(0, 0).rg;

  vec2 rel = v_uv - 0.5;
  float phi = radians(u_direction);
  if (u_directionMode == 1) phi = atan(rel.y, rel.x) + PI * 0.5; // swirl
  else if (u_directionMode == 2) phi = atan(rel.y, rel.x);       // radial

  // Isotropic part: Karl Sims' stencil (≈ 0.3 · h²∇²).
  vec2 n = neighbor(0, 1).rg, so = neighbor(0, -1).rg, e = neighbor(1, 0).rg, w = neighbor(-1, 0).rg;
  vec2 ne = neighbor(1, 1).rg, nw = neighbor(-1, 1).rg, se = neighbor(1, -1).rg, sw = neighbor(-1, -1).rg;
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

  int brush = brushMode();
  if (brush == 1) b = 1.0;
  else if (brush == 2) { a = 1.0; b = 0.0; }

  outColor = vec4(saturate(a), saturate(b), 0.0, 1.0);
}
