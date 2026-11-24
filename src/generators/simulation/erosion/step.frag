// Hydraulic erosion in one conservative gather pass. Water flows to lower neighbours (each
// cell's outflow is computed identically by the cell and by its neighbours, so water and
// sediment are conserved), carries sediment, erodes where its transport capacity exceeds its
// load and deposits where it falls below. State: r = terrain, g = water, b = sediment,
// a = initial terrain.
const ivec2 DIRS[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));

// The diamond of radius 2 around this cell, fetched once (13 texels): every outflow below is
// computed from it. Index (dy + 2) * 5 + (dx + 2); corners stay unused.
vec4 g[25];

vec4 cell(ivec2 o) {
  return g[(o.y + 2) * 5 + (o.x + 2)];
}

float pick(vec4 v, int i) {
  return dot(v, vec4(equal(ivec4(i), ivec4(0, 1, 2, 3))));
}

// Water leaving the cell at offset `o` toward each of its 4 neighbours this step.
vec4 outflows(ivec2 o) {
  vec4 c = cell(o);
  float h = c.r + c.g;
  vec4 drop;
  for (int i = 0; i < 4; i++) {
    vec4 n = cell(o + DIRS[i]);
    drop[i] = max(0.0, h - n.r - n.g);
  }
  float total = dot(drop, vec4(1.0));
  if (total <= 0.0) return vec4(0.0);
  // 0.2 = 1 / (neighbours + 1): equalizes levels without overshooting.
  return min(c.g, total * 0.2) * drop / total;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  for (int dy = -2; dy <= 2; dy++)
    for (int dx = -2; dx <= 2; dx++)
      if (abs(dx) + abs(dy) <= 2) g[(dy + 2) * 5 + (dx + 2)] = stateAt(p + ivec2(dx, dy));
  vec4 c = cell(ivec2(0));

  vec4 out4 = outflows(ivec2(0));
  float outSum = dot(out4, vec4(1.0));
  float water = c.g - outSum;
  float sediment = c.g > 1e-7 ? c.b * (1.0 - outSum / c.g) : c.b;
  float inSum = 0.0;
  float maxDrop = 0.0;
  float around = 0.0;
  // Thermal erosion: rock slides between neighbours steeper than the talus angle
  // (antisymmetric pairwise flux: conservative).
  float talus = tan(radians(u_talus)) / u_relief;
  float slide = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 n = cell(DIRS[i]);
    float f = pick(outflows(DIRS[i]), i ^ 1);
    inSum += f;
    water += f;
    if (n.g > 1e-7) sediment += n.b * f / n.g;
    maxDrop = max(maxDrop, c.r - n.r);
    around += n.r;
    float diff = c.r - n.r;
    slide += 0.1 * (max(0.0, -diff - talus) - max(0.0, diff - talus));
  }

  // Transport capacity: water flux × terrain slope (height range = u_relief cells).
  float slope = max(maxDrop * u_relief, 0.01);
  float capacity = u_capacity * 0.5 * (outSum + inSum) * slope;
  float terrain = c.r;
  if (sediment > capacity) {
    float deposit = u_deposition * (sediment - capacity);
    terrain += deposit;
    sediment -= deposit;
  } else {
    float erode = min(u_erosion * (capacity - sediment), 0.002);
    // Strata: hardness alternates with altitude (terraced canyons).
    if (u_strata > 0.0)
      erode *= 1.0 - 0.9 * u_strata * smoothstep(0.2, 0.8, 0.5 + 0.5 * sin(TAU * c.r * float(u_layers)));
    // Hard rock (bright Hardness input) resists.
    if (u_has_hardness) erode *= 1.0 - 0.9 * saturate(luminance(texture(u_in_hardness, (vec2(p) + 0.5) / u_gridSize).rgb));
    terrain -= erode;
    sediment += erode;
  }
  // Thermal softening: plain diffusion (conservative), removes one-cell spikes and pits.
  terrain += u_softening * 0.1 * (around * 0.25 - c.r) + slide;

  float rain = u_rain * 2e-4 * hash12(vec2(p) + fract(u_frame * 0.618) * 97.0) * 2.0;
  water = max(0.0, water) * (1.0 - u_evaporation * 0.02) + rain;
  int brush = brushMode();
  if (brush == 1) water += 0.004;
  else if (brush == 2) water = 0.0;
  outColor = vec4(terrain, water, max(sediment, 0.0), c.a);
}
