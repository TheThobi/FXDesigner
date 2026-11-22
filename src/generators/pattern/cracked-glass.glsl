// Shattered glass (impact at the center), built from straight segments only:
//  - radial cracks: rays with slight kinks between radial knots and random lengths;
//  - concentric cracks: straight chords between two neighbouring rays (spider-web look);
//  - crushed core: small Voronoi shards around the impact.
float wrapAngle(float x) { return x - TAU * floor((x + PI) / TAU); }

// Angle of ray i at radius r (piecewise linear kinks, knots every 0.2).
float rayAngle(float i, float r, float k) {
  float base = (i + 0.5 + (hash12(vec2(i, 1.3)) - 0.5) * 0.7) * TAU / k;
  float seg = r / 0.2;
  float j = floor(seg);
  float o0 = j < 0.5 ? 0.0 : (hash12(vec2(i, j + 7.0)) - 0.5) * 0.16;
  float o1 = (hash12(vec2(i, j + 8.0)) - 0.5) * 0.16;
  return base + mix(o0, o1, fract(seg));
}

float rayLength(float i) { return mix(0.55, 1.5, hash12(vec2(i, 4.4))) * u_length; }

vec2 rayPoint(float i, float r, float k) {
  float a = rayAngle(i, r, k);
  return r * vec2(cos(a), sin(a));
}

float crackedGlass(vec2 uv) {
  vec2 p = centered(uv);
  float r = length(p);
  float a = atan(p.y, p.x);
  float k = float(u_cracks);
  float px = 2.0 / u_resolution.x;
  float w = u_width * 0.0035;
  float s0 = floor(wrapAngle(a) / (TAU / k) + k); // sector index, shifted positive
  float v = 0.0;
  for (int ds = -1; ds <= 1; ds++) {
    float i = mod(s0 + float(ds), k);
    // Radial crack i (thinner far from the impact).
    float len = rayLength(i);
    if (r < len) {
      float d = r * abs(wrapAngle(a - rayAngle(i, r, k)));
      float wi = w * mix(1.6, 0.6, r / len);
      v = max(v, 1.0 - smoothstep(wi, wi + px, d));
    }
    // Concentric chords between ray i and ray i + 1.
    float i2 = mod(i + 1.0, k);
    float len2 = min(len, rayLength(i2));
    for (int j = 0; j < 5; j++) {
      float fj = float(j);
      vec2 key = vec2(i, fj);
      float ra = (fj + 1.0) * 0.16 * u_length * mix(0.8, 1.2, hash12(key + 2.1));
      float rb = ra * mix(0.85, 1.15, hash12(key + 3.7));
      if (rb > len2 || ra > len2 || hash12(key + 9.3) > u_amount) continue;
      float d = sdSegment(p, rayPoint(i, ra, k), rayPoint(i2, rb, k));
      float wj = w * 0.8;
      v = max(v, (1.0 - smoothstep(wj, wj + px, d)) * 0.85);
    }
  }
  // Crushed core around the impact.
  float core = 0.09 * u_length;
  if (r < core * 1.6) {
    vec4 vn = voronoiNearest(p * 26.0 / max(u_length, 0.3), vec2(1e4), 1.0);
    float edge = 1.0 - smoothstep(0.03, 0.03 + px * 26.0, vn.z);
    v = max(v, edge * smoothstep(core * 1.6, core * 0.6, r));
    v = max(v, smoothstep(core * 0.35, 0.0, r));
  }
  return v;
}

vec4 generate(vec2 uv) {
  return vec4(vec3(saturate(crackedGlass(uv))), 1.0);
}
