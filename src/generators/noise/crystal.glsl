// Crystal (in the spirit of Substance Designer's Crystal 2): long thin translucent shards,
// mostly along one direction, layered additively around mid gray. Each shard is a sliver
// (wide base, sharp tip) shaded like a facet: brighter on one side of its ridge, fading
// toward the tip; it lightens or darkens what lies under it. Seamless (cells wrap).
vec4 generate(vec2 uv) {
  float sum = 0.0;
  float count = 0.0;
  float scale = max(1.0, floor(u_scale + 0.5));
  float amp = 1.0;
  float base = radians(u_angle);
  for (int layer = 0; layer < 4; layer++) {
    if (layer >= u_layers) break;
    float fl = float(layer);
    vec2 p = uv * scale;
    vec2 cell = floor(p);
    float aa = scale * 1.5 / u_resolution.x;
    for (int j = -2; j <= 2; j++) {
      for (int i = -2; i <= 2; i++) {
        vec2 c = cell + vec2(float(i), float(j));
        vec2 wc = wrapCell(c, vec2(scale));
        for (int k = 0; k < 6; k++) {
          if (k >= u_density) break;
          vec2 key = wc + vec2(fl * 37.1 + float(k) * 5.3, fl * 11.7 + float(k) * 3.1);
          vec2 h1 = hash22(key);
          vec2 h2 = hash22(key + 13.3);
          vec2 h3 = hash22(key + 27.9);
          float ang = base + (h2.x - 0.5) * 2.0 * radians(u_spread);
          vec2 dir = vec2(cos(ang), sin(ang));
          vec2 d = p - (c + h1);
          float len = clamp(u_length, 0.2, 1.9) * mix(0.55, 1.0, h2.y);
          float s = dot(d, dir) / len; // -1 (base) .. 1 (tip)
          if (abs(s) >= 1.0) continue;
          float t = dot(d, vec2(-dir.y, dir.x));
          // Long diamond: pointed at both ends, widest a bit before the middle.
          float halfWidth = len * u_width * mix(0.5, 1.4, h3.x) * (1.0 - abs(s)) * (1.0 - 0.3 * s);
          float across = t / max(halfWidth, 1e-4);
          if (abs(across) >= 1.0) continue;
          float aw = min(0.9, aa / max(halfWidth, 1e-4));
          // Facet: a crisp lit edge fading across to a soft dark one (facet = 0: flat sliver).
          float ramp = mix(1.0, 0.5 + 0.5 * across, u_facet);
          float lit = smoothstep(1.0, 1.0 - aw, across);
          float soft = smoothstep(-1.0, -1.0 + max(aw, 0.6 * u_facet), across);
          float fade = sqrt(1.0 - abs(s));
          float sgn = h3.y > 0.5 ? 1.0 : -1.0;
          float edge = lit * soft;
          float side = ramp;
          sum += sgn * amp * edge * side * fade * mix(0.3, 1.0, hash12(key + 7.7));
        }
      }
    }
    count += float(u_density) * amp * amp;
    scale *= 2.0;
    amp *= 0.6;
  }
  float v = 0.5 + sum * 0.28 * u_contrast / sqrt(max(count, 1.0) * 0.5);
  return vec4(vec3(saturate(v)), 1.0);
}
