// Wave equation on a toroidal height field (symplectic Euler):
//   v += k (mean4(h) - h);  v *= 1 - damping;  h += v
// The discrete Laplacian's eigenvalues lie in [-2, 0], so the scheme is stable for k <= 2
// (u_waveSpeed in [0, 1] maps to k in [0, 1.8]). Energy comes from rain drops (one candidate
// per coarse cell per iteration) and the brush; the wind swell is analytic (mesh.vert).
const float DROP_CELLS = 8.0;

float dropsAt(vec2 uv) {
  vec2 cell = floor(uv * DROP_CELLS);
  float h = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 c = mod(cell + vec2(float(x), float(y)), DROP_CELLS);
      vec2 key = c + vec2(u_frame * 0.6180339, u_frame * 0.4142135) + u_seed * 0.01;
      if (hash12(key) > u_rain * 0.05) continue;
      vec2 center = (c + hash22(key + 1.7)) / DROP_CELLS;
      vec2 d = wrapDelta(uv, center);
      float size = u_dropSize * mix(0.5, 1.5, hash12(key + 9.1));
      h -= u_dropStrength * exp(-dot(d, d) / max(size * size, 1e-6));
    }
  }
  return h;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_gridSize;
  vec4 s = neighbor(0, 0);
  float h = s.r;
  float v = s.g;
  float mean = 0.25 * (neighbor(1, 0).r + neighbor(-1, 0).r + neighbor(0, 1).r + neighbor(0, -1).r);
  v += (mean - h) * 1.8 * u_waveSpeed;
  v *= 1.0 - u_damping;
  h += v;
  h += dropsAt(uv) * 0.25;
  int brush = brushMode();
  if (brush == 1) {
    vec2 d = brushDelta(uv, u_brush.xy) / max(u_brush.z, 1e-4);
    h -= u_dropStrength * 0.3 * exp(-4.0 * dot(d, d));
  } else if (brush == 2) {
    h *= 0.8;
    v *= 0.8;
  }
  outColor = vec4(h, v, 0.0, 1.0);
}
