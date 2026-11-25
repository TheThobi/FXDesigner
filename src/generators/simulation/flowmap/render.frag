// Flowmap Painter display. The node's OUTPUT is either the encoded flowmap (RG) or the
// Image input moving along the flow (RGBA). The PREVIEW (display only: the app renders the
// output with u_preview and u_arrows off for linked nodes and exports) shows the flow applied
// to the Image input, or to a test pattern while unconnected, beside the output. Without
// the preview, direction arrows can be drawn over the output (display only too).
//
// Flowing = classic two-phase flowmap (Vlachos 2010): two copies advected with phases half a
// cycle apart, each faded out exactly when its distortion resets, so the loop never pops.

const vec3 WATER_DEEP = vec3(0.04, 0.2, 0.3);
const vec3 WATER_SHALLOW = vec3(0.12, 0.48, 0.58);
const vec3 WATER_SKY = vec3(0.62, 0.84, 0.92);

// Soft, rounded swells (domain-warped fbm): reads as water, not hammered metal.
float waterHeight(vec2 uv) {
  vec2 period = vec2(max(1.0, floor(u_previewScale + 0.5)));
  vec2 p = uv * period;
  vec2 warp = vec2(gradientNoise(p + 3.1, period, 0.0), gradientNoise(p + 7.7, period, 0.0));
  return fbm(p + warp * 0.6, 2, 2.0, 0.45, period, 0.0, FBM_STANDARD);
}

vec3 waterNormal(vec2 uv) {
  float scale = max(u_previewScale, 1.0);
  float e = 0.03 / scale;
  float h = waterHeight(uv);
  float dx = (waterHeight(uv + vec2(e, 0.0)) - h) / e;
  float dy = (waterHeight(uv + vec2(0.0, e)) - h) / e;
  float s = 0.16 / scale;
  return normalize(vec3(-dx * s, -dy * s, 1.0));
}

// Test pattern, as a color (normal patterns return an encoded normal).
vec3 pattern(vec2 uv) {
  int mode = u_previewPattern;
  if (mode <= 1) return waterNormal(uv) * 0.5 + 0.5;
  float s = u_previewScale;
  if (mode == 2) {
    vec2 c = floor(uv * s);
    return vec3(0.25 + 0.5 * mod(c.x + c.y, 2.0));
  }
  if (mode == 3) {
    vec2 g = abs(fract(uv * s) - 0.5);
    return vec3(1.0 - smoothstep(0.44, 0.48, max(g.x, g.y)));
  }
  float p = max(1.0, floor(s + 0.5));
  return vec3(0.5 + 0.5 * fbm(uv * p, 4, 2.0, 0.5, vec2(p), 0.0, FBM_STANDARD));
}

vec3 shadeWater(vec3 n) {
  vec3 l = normalize(vec3(-0.4, 0.5, 0.75));
  float facing = n.z;
  // Body color from the slope (troughs deeper), sky reflection on tilted facets, a soft sun
  // glint: matte enough to read as water.
  vec3 c = mix(WATER_DEEP, WATER_SHALLOW, smoothstep(0.2, 0.9, dot(n, l)));
  float fresnel = pow(1.0 - facing, 3.0);
  c = mix(c, WATER_SKY, clamp(fresnel * 6.0, 0.0, 0.45));
  float glint = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 20.0);
  return c + glint * 0.25;
}

vec3 encoded(vec2 f) {
  if (u_flipGreen) f.y = -f.y;
  return vec3(f * 0.5 + 0.5, 0.0);
}

// Arrow glyph per grid cell, oriented along the flow at the cell center.
float arrows(vec2 uv) {
  float n = float(u_arrowDensity);
  vec2 center = (floor(uv * n) + 0.5) / n;
  vec2 f = sampleState(center).rg;
  float len = length(f);
  if (len < 0.03) return 0.0;
  vec2 dir = f / len;
  vec2 p = fract(uv * n) - 0.5;
  p = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
  float half_ = 0.38 * clamp(len, 0.25, 1.0);
  float shaft = max(abs(p.y) - 0.035, max(p.x - half_ + 0.12, -half_ - p.x));
  float head = max(abs(p.y) * 1.4 + (p.x - half_), -(p.x - half_ + 0.16));
  float d = min(shaft, head);
  float aa = fwidth(d);
  return 1.0 - smoothstep(-aa, aa, d);
}

// Phases of the two-phase flow at uv (a low-frequency offset hides the global breathing).
vec3 phases(vec2 uv) {
  float steps = float(max(u_stepsPerFrame, 1));
  float jitter = 0.5 + 0.5 * gradientNoise(uv * 3.0, vec2(3.0), 0.0);
  float t = u_frame / (60.0 * steps) * u_flowSpeed + jitter * 0.5;
  return vec3(fract(t), fract(t + 0.5), t);
}

// The Image input moving along the flow (transparent while unconnected).
vec4 flowingInput(vec2 uv, vec2 f) {
  if (!u_has_image) return vec4(0.0);
  vec3 p = phases(uv);
  vec2 flow = f * u_flowStrength * 0.12;
  float w0 = 1.0 - abs(1.0 - 2.0 * p.x);
  vec4 a = texture(u_in_image, fract(uv - flow * (p.x - 0.5)));
  vec4 b = texture(u_in_image, fract(uv - flow * (p.y - 0.5)));
  return mix(b, a, w0);
}

// Preview texture: the Image input if connected, else the test pattern (with a per-cycle
// jump so successive cycles don't repeat the same pattern position).
vec4 previewView(vec2 uv, vec2 f) {
  if (u_has_image) return flowingInput(uv, f);
  vec3 p = phases(uv);
  vec2 flow = f * u_flowStrength * 0.12;
  float w0 = 1.0 - abs(1.0 - 2.0 * p.x);
  vec2 jump0 = floor(p.z) * vec2(0.213, 0.137);
  vec2 jump1 = floor(p.z + 0.5) * vec2(0.213, 0.137) + 0.5;
  vec3 a = pattern(uv - flow * (p.x - 0.5) + jump0);
  vec3 b = pattern(uv - flow * (p.y - 0.5) + jump1);
  if (u_previewPattern <= 1) {
    // Blend normals (not colors) to keep the relief sharp, then shade or display.
    vec3 n = normalize(mix(b * 2.0 - 1.0, a * 2.0 - 1.0, w0));
    return vec4(u_previewPattern == 0 ? shadeWater(n) : n * 0.5 + 0.5, 1.0);
  }
  return vec4(mix(b, a, w0), 1.0);
}

// What the node passes on.
vec4 outputImage(vec2 uv, vec2 f) {
  return u_output == 0 ? vec4(encoded(f), 1.0) : flowingInput(uv, f);
}

// Direction arrows drawn over a display image (with a soft shadow).
vec4 withArrows(vec4 c, vec2 uv) {
  if (!u_arrows) return c;
  float shadow = arrows(uv + vec2(0.0, 0.06 / float(u_arrowDensity)));
  float a = arrows(uv);
  vec3 rgb = mix(mix(c.rgb, vec3(0.04), shadow * 0.6), vec3(1.0), a * 0.9);
  return vec4(rgb, max(c.a, max(a, shadow * 0.6)));
}

void main() {
  vec2 f = sampleState(v_uv).rg;
  if (!u_preview) {
    // The output, with the direction arrows over it (display only).
    outColor = withArrows(outputImage(v_uv, f), v_uv);
    return;
  }
  bool full = u_previewLayout == 1;
  outColor = full || v_uv.x >= u_splitPos ? previewView(v_uv, f) : outputImage(v_uv, f);
}
