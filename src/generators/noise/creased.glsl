// Creased (in the spirit of Substance Designer's Creased): a crumpled sheet as a height map.
// Each octave scatters short straight creases on a grid; a crease is a ridge or a valley with
// a sharp crest (tent profile across, fading at its ends). Summed over octaves they give the
// network of fold lines between flat-ish facets of crumpled paper / foil. Seamless.
vec4 generate(vec2 uv) {
  vec2 warp = vec2(fbm(uv * 2.0, 3, 2.0, 0.5, vec2(2.0), 0.0, 0),
                   fbm(uv * 2.0 + 17.3, 3, 2.0, 0.5, vec2(2.0), 0.0, 0)) - 0.5;
  vec2 q = uv + warp * u_warp * 0.08;
  float h = 0.0;
  float amp = 1.0;
  float total = 0.0;
  float scale = max(1.0, floor(u_scale + 0.5));
  for (int o = 0; o < 6; o++) {
    if (o >= u_octaves) break;
    float fo = float(o);
    vec2 p = q * scale;
    vec2 cell = floor(p);
    for (int j = -2; j <= 2; j++) {
      for (int i = -2; i <= 2; i++) {
        vec2 c = cell + vec2(float(i), float(j));
        vec2 wc = wrapCell(c, vec2(scale));
        for (int k = 0; k < 4; k++) {
          if (k >= u_density) break;
          vec2 key = wc + vec2(fo * 19.3 + float(k) * 5.1, fo * 7.7 + float(k) * 3.3);
          vec2 h1 = hash22(key);
          vec2 h2 = hash22(key + 4.7);
          float ang = h2.x * PI;
          vec2 dir = vec2(cos(ang), sin(ang));
          vec2 d = p - (c + h1);
          float s = dot(d, dir);
          float t = dot(d, vec2(-dir.y, dir.x));
          float len = u_length * mix(0.5, 1.0, h2.y);
          float radius = u_width * mix(0.6, 1.2, hash12(key + 2.1));
          float across = 1.0 - abs(t) / radius;
          if (across <= 0.0 || abs(s) >= len) continue;
          float along = 1.0 - smoothstep(len * 0.4, len, abs(s));
          // Tent profile, sharpened: a crisp crease line on the crest.
          float profile = pow(across, u_sharpness);
          float sgn = hash12(key + 9.9) > 0.5 ? 1.0 : -1.0;
          h += sgn * amp * profile * along;
        }
      }
    }
    total += amp;
    amp *= u_roughness;
    scale *= 2.0;
  }
  float v = 0.5 + h / max(total, 1e-3) * 0.6 * u_contrast;
  return vec4(vec3(saturate(v)), 1.0);
}
