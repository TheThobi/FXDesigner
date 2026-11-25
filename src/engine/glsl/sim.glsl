// ---- sim: helpers for grid simulations (state in u_state) -----------------------------------
// Requires: uniform sampler2D u_state; uniform vec4 u_brush;

ivec2 stateSize() { return textureSize(u_state, 0); }

bool openEdges() {
#ifdef SIM_OPEN_BOUNDARIES
  return u_boundaries == 1;
#else
  return false;
#endif
}

// Open edges extend velocity outward, with zero outside pressure and density.
vec4 stateAt(ivec2 p) {
  ivec2 size = stateSize();
  if (openEdges()) {
    ivec2 edge = clamp(p, ivec2(0), size - 1);
    vec4 s = texelFetch(u_state, edge, 0);
    return any(notEqual(p, edge)) ? vec4(s.rg, 0.0, 0.0) : s;
  }
  return texelFetch(u_state, ((p % size) + size) % size, 0);
}

// State of the neighbour at (dx, dy) relative to the current fragment.
vec4 neighbor(int dx, int dy) { return stateAt(ivec2(gl_FragCoord.xy) + ivec2(dx, dy)); }

// Bilinearly interpolated state, stopping at the edge cell centers in Open mode.
vec4 sampleState(vec2 uv) {
  vec2 size = vec2(stateSize());
  vec2 p = uv * size - 0.5;
  if (openEdges()) p = clamp(p, vec2(0.0), size - 1.0);
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  return mix(mix(stateAt(i), stateAt(i + ivec2(1, 0)), f.x),
             mix(stateAt(i + ivec2(0, 1)), stateAt(i + ivec2(1, 1)), f.x), f.y);
}

#ifdef SIM_EXTRA_STATE
// Second state texture (same grid): every step pass must also write outColor2.
vec4 stateAt2(ivec2 p) {
  ivec2 size = stateSize();
  if (openEdges()) {
    ivec2 edge = clamp(p, ivec2(0), size - 1);
    return any(notEqual(p, edge)) ? vec4(0.0) : texelFetch(u_state2, edge, 0);
  }
  return texelFetch(u_state2, ((p % size) + size) % size, 0);
}

vec4 neighbor2(int dx, int dy) { return stateAt2(ivec2(gl_FragCoord.xy) + ivec2(dx, dy)); }

vec4 sampleState2(vec2 uv) {
  vec2 size = vec2(stateSize());
  vec2 p = uv * size - 0.5;
  if (openEdges()) p = clamp(p, vec2(0.0), size - 1.0);
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  return mix(mix(stateAt2(i), stateAt2(i + ivec2(1, 0)), f.x),
             mix(stateAt2(i + ivec2(0, 1)), stateAt2(i + ivec2(1, 1)), f.x), f.y);
}
#endif

// Mean of the 3x3 neighbourhood (including the center).
vec4 boxAverage() {
  vec4 sum = vec4(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) sum += neighbor(x, y);
  return sum / 9.0;
}

// Brush radii are fractions of the short side.
vec2 brushScale() {
  return u_gridSize / min(u_gridSize.x, u_gridSize.y);
}

vec2 brushDelta(vec2 uv, vec2 center) {
  return (openEdges() ? uv - center : wrapDelta(uv, center)) * brushScale();
}

// Brush: 0 = none, 1 = paint, 2 = erase. Wrap mode paints across edges.
int brushMode() {
  if (u_brush.w < 0.5) return 0;
  vec2 d = brushDelta(v_uv, u_brush.xy);
  if (length(d) > u_brush.z) return 0;
  return u_brush.w < 1.5 ? 1 : 2;
}
