// Comic "KAPOW" burst: jagged star with random spikes, inner layer and ink outline.
// Tones: 0.2 outline, 0.6 outer burst, 1.0 inner burst; alpha = silhouette.
float vertexRadius(float i, float salt, float boil) {
  float h = hash12(vec2(i, salt + boil * 13.7));
  bool tip = mod(i, 2.0) < 0.5;
  return tip ? 1.0 - h * u_randomness * 0.45 : u_inner * (1.0 + (h - 0.5) * u_randomness * 0.3);
}

float burstRadius(float a, float salt, float boil) {
  float total = float(u_spikes) * 2.0;
  float idx = (a + PI) / TAU * total;
  float i0 = floor(idx);
  return mix(vertexRadius(mod(i0, total), salt, boil), vertexRadius(mod(i0 + 1.0, total), salt, boil), fract(idx));
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
