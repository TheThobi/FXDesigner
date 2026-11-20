// Sci-fi energy shield: hexagon grid with fresnel rim, pulsing cells and an expanding wave.
const vec2 HEX_S = vec2(1.0, 1.7320508);

// xy = offset from the hex center, zw = hex id.
vec4 hexCell(vec2 p) {
  vec2 h = HEX_S * 0.5;
  vec2 a = mod(p, HEX_S) - h;
  vec2 b = mod(p - h, HEX_S) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return vec4(gv, p - gv);
}

// 0 at the center, 0.5 on the edges.
float hexDist(vec2 p) {
  p = abs(p);
  return max(dot(p, normalize(HEX_S)), p.x);
}

vec4 generate(vec2 uv) {
  vec2 c = centered(uv);
  float r = length(c);
  float mask = 1.0;
  float fresnel = 0.0;
  vec2 q = c;
  if (u_dome) {
    mask = 1.0 - smoothstep(0.97, 1.0, r);
    float z = sqrt(max(1.0 - r * r, 0.0));
    q = c / (z + 0.6);
    fresnel = pow(1.0 - z, u_fresnelPower);
  }
  vec4 h = hexCell(q * u_scale + vec2(0.0, u_time * u_scroll));
  float aa = u_scale * 3.0 / u_resolution.x;
  float edge = smoothstep(0.5 - u_lineWidth - aa, 0.5 - u_lineWidth, hexDist(h.xy));
  float pulse = pow(0.5 + 0.5 * sin(u_time * u_pulseSpeed + hash12(h.zw) * TAU), 6.0) * u_cellGlow;
  float wavePos = fract(u_time * u_waveSpeed) * 1.6 - 0.2;
  float wave = exp(-abs(r - wavePos) * 18.0) * u_wave;
  float v = edge * (0.35 + 0.65 * fresnel) + pulse * (1.0 - edge) * 0.6 + wave * (edge + 0.3) + fresnel * u_rim;
  return vec4(vec3(saturate(v * mask)), 1.0);
}
