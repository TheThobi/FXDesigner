// Comic "KAPOW" burst: jagged star with random spikes, inner layer and ink outline.
// Tones: 0.2 outline, 0.6 outer burst, 1.0 inner burst; alpha = silhouette.
// Vertex indices are wrapped with integer math: a float `mod(total, total)` may return `total`
// on GPUs that compute x / y as x * (1 / y), which broke the seam at angle ±PI (left side).
float vertexRadius(int i, float salt, float boil) {
  float h = hash12(vec2(float(i), salt + boil * 13.7));
  bool tip = (i - 2 * (i / 2)) == 0;
  return tip ? 1.0 - h * u_randomness * 0.45 : u_inner * (1.0 + (h - 0.5) * u_randomness * 0.3);
}

int wrapIndex(int i, int n) {
  int m = i - n * (i / n);
  return m < 0 ? m + n : m;
}

float burstRadius(float a, float salt, float boil) {
  int total = u_spikes * 2;
  // `a` may exceed PI (phase offset): wrap to [0, TAU) first.
  float t = fract((a + PI) / TAU);
  float idx = t * float(total);
  int i0 = int(floor(idx));
  float r0 = vertexRadius(wrapIndex(i0, total), salt, boil);
  float r1 = vertexRadius(wrapIndex(i0 + 1, total), salt, boil);
  return mix(r0, r1, idx - float(i0));
}

vec4 generate(vec2 uv) {
  vec2 p = rotate2d(centered(uv), radians(u_rotation)) / u_size;
  float r = length(p);
  float a = atan(p.y, p.x);
  float boil = floor(u_time * u_boil);
  float aa = 2.0 / (u_resolution.x * u_size);

  float d = r - burstRadius(a, 1.0, boil);
  float mask = 1.0 - smoothstep(-aa, aa, d);
  float v = 0.6;
  if (u_layers) {
    float d2 = r - burstRadius(a + 0.3, 5.0, boil) * u_innerScale;
    v = mix(v, 1.0, 1.0 - smoothstep(-aa, aa, d2));
  }
  float line = smoothstep(-u_outlineWidth - aa, -u_outlineWidth + aa, d);
  v = mix(v, 0.2, line);
  return vec4(vec3(v), mask);
}
