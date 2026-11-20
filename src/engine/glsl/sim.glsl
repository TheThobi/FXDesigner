// ---- sim: helpers for grid simulations (state in u_state, toroidal wrap) ----------------------
// Requires: uniform sampler2D u_state; uniform vec4 u_brush;

ivec2 stateSize() { return textureSize(u_state, 0); }

// State at integer cell coordinates, wrapped.
vec4 stateAt(ivec2 p) {
  ivec2 size = stateSize();
  return texelFetch(u_state, ((p % size) + size) % size, 0);
}

// State of the neighbour at (dx, dy) relative to the current fragment.
vec4 neighbor(int dx, int dy) { return stateAt(ivec2(gl_FragCoord.xy) + ivec2(dx, dy)); }

// Bilinearly interpolated state at uv (float textures are not filterable), wrapped.
vec4 sampleState(vec2 uv) {
  vec2 p = uv * vec2(stateSize()) - 0.5;
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  return mix(mix(stateAt(i), stateAt(i + ivec2(1, 0)), f.x),
             mix(stateAt(i + ivec2(0, 1)), stateAt(i + ivec2(1, 1)), f.x), f.y);
}

// Mean of the 3x3 neighbourhood (including the center).
vec4 boxAverage() {
  vec4 sum = vec4(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) sum += neighbor(x, y);
  return sum / 9.0;
}

// Brush: 0 = none, 1 = paint, 2 = erase. Distance is wrapped so painting crosses edges.
int brushMode() {
  if (u_brush.w < 0.5) return 0;
  vec2 d = abs(v_uv - u_brush.xy);
  d = min(d, 1.0 - d);
  if (length(d) > u_brush.z) return 0;
  return u_brush.w < 1.5 ? 1 : 2;
}
