// Post-processing pass, applied to every generator. Per evaluation point:
//   source -> levels -> posterize/dither -> halftone -> color ramp -> relief lighting
//   -> alpha -> outline   (each stage is a module with an on/off uniform)
// then supersampled (SSAA) or pixelated. Output may instead be a normal or height map.
// Parameter uniforms are injected from POST_PARAMS; common + noise chunks are prepended.

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_source;
uniform vec2 u_pixelSize;   // one output pixel, in texture uv
uniform float u_viewTiles;
uniform bool u_premultiply;

const float REF = 512.0;    // "px @512" reference for resolution-independent sizes

vec2 g_ditherCoord;
vec2 g_block;               // pixel block size in uv (0 when not pixelating)

float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 levels(vec3 c) {
  if (!u_levelsOn) return c;
  c = (c - 0.5) * u_contrast + 0.5 + u_brightness;
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / u_gamma));
  return u_invert ? 1.0 - c : c;
}

float bayer4(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[q.x + q.y * 4]) + 0.5) / 16.0;
}

float posterizeTone(float v) {
  if (!u_posterizeOn) return v;
  float n = float(u_posterize - 1);
  float offset = u_dither ? bayer4(g_ditherCoord) - 0.5 : 0.0;
  return clamp(floor(v * n + 0.5 + offset) / n, 0.0, 1.0);
}

// Source sample; when pixelating, averages 3x3 taps over the block (clean downsampling).
vec4 sampleSource(vec2 uv) {
  if (g_block.x <= 0.0) return texture(u_source, uv);
  vec4 sum = vec4(0.0);
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) sum += texture(u_source, uv + vec2(float(x), float(y)) * g_block / 3.0);
  return sum / 9.0;
}

float heightAt(vec2 uv) {
  vec4 s = sampleSource(uv);
  return u_heightSource == 1 ? s.a : lum(levels(s.rgb));
}

// Stylized tone and source alpha (what outlines detect).
vec2 toneAt(vec2 uv) {
  vec4 s = sampleSource(uv);
  return vec2(posterizeTone(lum(levels(s.rgb))), s.a);
}

float halftone(float v, vec2 uv) {
  if (!u_halftoneOn) return v;
  float n = float(u_halftone);
  float a = radians(u_halftoneAngle);
  vec2 q = rotate2d(uv, a) * n;
  vec2 cell = floor(q) + 0.5;
  float t = toneAt(rotate2d(cell / n, -a)).x;
  float radius = sqrt(1.0 - t) * 0.75;
  float aa = n * length(u_pixelSize) * 1.5;
  return smoothstep(radius - aa, radius + aa, length(q - cell));
}

vec4 rampColor(float t) { return texture(u_gradient, vec2((t * 255.0 + 0.5) / 256.0, 0.5)); }

// Height gradient (d height / d uv) with central differences at step o.
vec2 heightGradient(vec2 uv, vec2 o) {
  return vec2(heightAt(uv + vec2(o.x, 0.0)) - heightAt(uv - vec2(o.x, 0.0)),
              heightAt(uv + vec2(0.0, o.y)) - heightAt(uv - vec2(0.0, o.y))) / (2.0 * o);
}

vec3 paintLighting(vec3 albedo, vec2 uv, vec2 grad, vec2 o) {
  vec3 n = normalize(vec3(-grad * u_bumpStrength * 0.12, 1.0));
  float la = radians(u_lightAngle);
  float le = radians(u_lightElevation);
  vec3 l = vec3(cos(la) * cos(le), sin(la) * cos(le), sin(le));
  float shade = saturate(dot(n, l));
  if (u_lighting == 2) {
    float b = float(u_bands - 1);
    float f = shade * b;
    float s = u_bandSoftness * 0.5;
    shade = (floor(f) + smoothstep(0.5 - s, 0.5 + s + 1e-3, fract(f))) / b;
  }
  vec3 col = albedo * mix(u_shadowColor, u_highlightColor, shade);

  // Curvature (Laplacian at a wider radius): > 0 on convex rims, < 0 in cavities.
  vec2 r = max(o, vec2(u_curvatureRadius / REF));
  float h = heightAt(uv);
  float avg = 0.25 * (heightAt(uv + vec2(r.x, 0.0)) + heightAt(uv - vec2(r.x, 0.0)) +
                      heightAt(uv + vec2(0.0, r.y)) + heightAt(uv - vec2(0.0, r.y)));
  float curv = (h - avg) * 12.0;
  col = mix(col, col * u_shadowColor * 0.7, saturate(-curv) * u_cavity);
  col = mix(col, u_highlightColor, saturate(curv) * u_edgeHighlight * 0.7);
  return col;
}

float edgeAt(vec2 uv, vec2 o) {
  vec2 c = toneAt(uv);
  int taps = g_block.x > 0.0 && u_pixelMode == 0 ? 4 : 8;
  float e = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= taps) break;
    float a = float(i) * TAU / float(taps);
    vec2 d = toneAt(uv + vec2(cos(a), sin(a)) * o) - c;
    float diff = u_outlineSide == 1 ? max(d.x, d.y) : u_outlineSide == 2 ? max(-d.x, -d.y) : max(abs(d.x), abs(d.y));
    e = max(e, diff);
  }
  return smoothstep(u_outlineThreshold, u_outlineThreshold * 1.5 + 0.01, e);
}

// ---- Painterly modules -------------------------------------------------------------------

vec3 colorGrade(vec3 c) {
  if (!u_gradeOn) return c;
  // Hue rotation in YIQ space, then saturation around luma.
  const mat3 toYiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  const mat3 toRgb = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 yiq = toYiq * c;
  float a = radians(u_hueShift);
  yiq.yz = mat2(cos(a), sin(a), -sin(a), cos(a)) * yiq.yz * u_saturation;
  c = toRgb * yiq;
  c += vec3(0.08, 0.02, -0.08) * u_temperature;
  float shadow = 1.0 - smoothstep(0.0, 0.55, lum(c));
  c = mix(c, c + u_shadowTint * 0.6, shadow * u_shadowLift);
  return clamp(c, 0.0, 1.0);
}

// Periodic fbm on the texture (tiles because uv is in [0,1] and the period is integer).
float tileNoise(vec2 uv, float scale, int octaves) {
  float p = max(1.0, floor(scale + 0.5));
  return fbm(uv * p, octaves, 2.0, 0.5, vec2(p), 0.0, FBM_STANDARD);
}

vec3 watercolor(vec3 c, vec2 uv) {
  if (!u_watercolorOn) return c;
  // Pigment pools where the tone changes: darken along gradients.
  vec2 w = vec2(u_wetEdgeWidth / REF);
  float gx = lum(sampleSource(uv + vec2(w.x, 0.0)).rgb) - lum(sampleSource(uv - vec2(w.x, 0.0)).rgb);
  float gy = lum(sampleSource(uv + vec2(0.0, w.y)).rgb) - lum(sampleSource(uv - vec2(0.0, w.y)).rgb);
  float edge = smoothstep(0.03, 0.3, length(vec2(gx, gy)));
  c *= 1.0 - u_wetEdges * edge * 0.45;
  // Uneven washes (low frequency) and granulation (high frequency).
  float wash = tileNoise(uv + 7.3, 3.0, 3);
  c *= 1.0 - u_bleed * 0.25 * (0.5 + 0.5 * wash);
  float grain = tileNoise(uv + 1.7, 96.0, 2);
  c *= 1.0 - u_granulation * 0.22 * smoothstep(-0.2, 0.6, grain);
  return c;
}

vec3 paper(vec3 c, vec2 uv) {
  if (!u_paperOn) return c;
  float s = u_paperScale;
  float g;
  if (u_paperType == 1) {
    // Canvas weave: alternating over/under threads.
    float p = max(1.0, floor(s * 12.0 + 0.5));
    vec2 q = uv * p;
    vec2 f = fract(q);
    float checker = mod(floor(q.x) + floor(q.y), 2.0);
    float thread = mix(sin(f.x * PI), sin(f.y * PI), checker);
    g = thread * 0.7 + 0.3 * tileNoise(uv, p, 1);
  } else if (u_paperType == 2) {
    // Fibers: stretched noise in two directions.
    g = 0.5 * tileNoise(vec2(uv.x * 4.0, uv.y), s * 4.0, 3) +
        0.5 * tileNoise(vec2(uv.x, uv.y * 4.0) + 3.1, s * 4.0, 3);
  } else {
    g = 0.6 * tileNoise(uv, s * 6.0, 4) + 0.4 * tileNoise(uv + 5.0, s * 24.0, 2);
  }
  return c * (1.0 - u_paperAmount * 0.35 * (0.5 - 0.5 * g));
}

// Full look at one point. `o` = neighbour distance for outlines/lighting (uv).
vec4 evaluate(vec2 uv, vec2 o) {
  if (u_output == 1) {
    vec2 stepUv = g_block.x > 0.0 ? g_block : u_pixelSize;
    vec2 slope = -heightGradient(uv, stepUv) * (u_normalStrength * 0.01);
    vec3 n = normalize(vec3(slope, 1.0));
    if (u_normalFlipY) n.y = -n.y;
    return vec4(n * 0.5 + 0.5, 1.0);
  }
  if (u_output == 2) return vec4(vec3(heightAt(uv)), 1.0);

  vec4 src = sampleSource(uv);
  vec3 c = levels(src.rgb);
  float l = lum(c);
  float t = halftone(posterizeTone(l), uv);
  bool stylized = u_posterizeOn || u_halftoneOn;

  vec4 color;
  if (u_colorMode == 1) color = rampColor(t);
  else color = vec4(stylized ? c * (t / max(l, 1e-4)) : c, 1.0);

  color.rgb = colorGrade(color.rgb);
  if (u_lightingOn) {
    vec2 grad = heightGradient(uv, max(o, vec2(1.5 / REF)));
    color.rgb = paintLighting(color.rgb, uv, grad, o);
  }
  color.rgb = watercolor(color.rgb, uv);
  color.rgb = paper(color.rgb, uv);

  float alpha = 1.0;
  if (u_alphaMode == 1) alpha = t;
  else if (u_alphaMode == 2) alpha = color.a;
  else if (u_alphaMode == 3) alpha = src.a;
  color.a = alpha;

  if (u_outlineOn && u_outline > 0.0) {
    float e = edgeAt(uv, o) * u_outline;
    color.rgb = mix(color.rgb, u_outlineColor, e);
    color.a = max(color.a, e);
  }
  return vec4(clamp(color.rgb, 0.0, 1.0), color.a);
}

void main() {
  vec2 uv = fract(v_uv * u_viewTiles);
  vec4 color;

  if (u_pixelateOn) {
    float n = float(u_pixelate);
    vec2 cell = floor(uv * n);
    vec2 center = (cell + 0.5) / n;
    if (u_pixelMode == 0) {
      // Pixel art: every effect operates on the block grid.
      g_block = vec2(1.0 / n);
      g_ditherCoord = cell;
      color = evaluate(center, g_block);
    } else {
      // Final image: full-resolution look, sampled once per block.
      g_block = vec2(0.0);
      g_ditherCoord = cell;
      color = evaluate(center, vec2(u_outlineWidth / REF));
    }
  } else {
    g_block = vec2(0.0);
    g_ditherCoord = gl_FragCoord.xy;
    vec2 o = vec2(u_outlineWidth / REF);
    if (!u_antialiasOn) {
      // Fast path: a single evaluation (software rasterizers execute masked loop bodies).
      color = evaluate(uv, o);
    } else {
      int k = clamp(u_antialias + 1, 2, 4);
      vec4 acc = vec4(0.0);
      for (int y = 0; y < k; y++) {
        for (int x = 0; x < k; x++) {
          vec2 jitter = (vec2(float(x), float(y)) + 0.5) / float(k) - 0.5;
          vec4 c = evaluate(uv + jitter * u_pixelSize, o);
          acc += vec4(c.rgb * c.a, c.a); // average premultiplied
        }
      }
      acc /= float(k * k);
      color = acc.a > 1e-5 ? vec4(acc.rgb / acc.a, acc.a) : vec4(0.0);
    }
  }

  if (u_premultiply) color.rgb *= color.a;
  outColor = color;
}
