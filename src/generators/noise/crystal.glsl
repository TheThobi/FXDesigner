// Crystal (in the spirit of Substance's Crystal 2): crystalline shards scattered on a grid.
// Each shard is a long rhombus shaded like a prism: a bright face and a darker face either
// side of its ridge, dimmer toward the tips. Shards occlude each other by a random depth;
// each extra layer adds smaller shards on top. Seamless (cells wrap).
vec4 generate(vec2 uv) {
  float v = 0.0;
  float bestDepth = -1.0;
  float scale = max(1.0, floor(u_scale + 0.5));
  float len0 = clamp(u_size, 0.2, 1.9);
  for (int layer = 0; layer < 5; layer++) {
    if (layer >= u_layers) break;
    float fl = float(layer);
    vec2 p = uv * scale;
    vec2 cell = floor(p);
    float aa = scale * 1.5 / u_resolution.x;
    for (int j = -2; j <= 2; j++) {
      for (int i = -2; i <= 2; i++) {
        vec2 c = cell + vec2(float(i), float(j));
        vec2 wc = wrapCell(c, vec2(scale));
        for (int k = 0; k < 4; k++) {
          if (k >= u_density) break;
          vec2 key = wc + vec2(fl * 31.7 + float(k) * 7.3, fl * 13.1 + float(k) * 2.9);
          vec2 h1 = hash22(key);
          vec2 h2 = hash22(key + 11.7);
          float ang = radians(u_angle) + (h2.x - 0.5) * PI * u_disorder;
          vec2 dir = vec2(cos(ang), sin(ang));
          vec2 d = p - (c + h1);
          float s = dot(d, dir);
          float t = dot(d, vec2(-dir.y, dir.x));
          float len = len0 * mix(0.45, 1.0, h2.y);
          float wid = max(len * u_thinness * mix(0.6, 1.3, hash12(key + 3.1)), 1e-3);
          float shape = abs(s) / len + abs(t) / wid;
          if (shape >= 1.0) continue;
          float depth = fl + hash12(key + 8.3);
          if (depth < bestDepth) continue;
          // Prism shading: one face lit, the other darker; tips fade.
          float face = t > 0.0 ? 1.0 : 1.0 - u_facet;
          float tone = mix(0.35, 1.0, hash12(key + 5.9)) * face;
          tone *= 1.0 - 0.4 * u_facet * abs(s) / len;
          // Thin dark outline (and anti-aliasing) at the shard border.
          tone *= smoothstep(1.0, 1.0 - max(aa / wid, u_edge), shape);
          bestDepth = depth;
          v = tone;
        }
      }
    }
    scale *= 2.0;
    len0 = max(0.2, len0 * 0.85);
  }
  return vec4(vec3(saturate(v)), 1.0);
}
