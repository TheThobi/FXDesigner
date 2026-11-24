// Spectral chains: seamless columns of interlocking links (face-on rings alternate with
// side-on bars) swaying and scrolling, with a ghostly glow and fading pulses.
float chainLink(vec2 q, float k, float L) {
  float h = L * 0.62;
  float wl = L * 0.24 * u_linkWidth;
  float th = L * 0.09 * u_thickness;
  vec2 c = vec2(0.0, (k + 0.5) * L);
  float d;
  if (mod(k, 2.0) < 0.5) {
    // Face-on: stadium outline.
    d = abs(sdSegment(q, c - vec2(0.0, h - wl), c + vec2(0.0, h - wl)) - wl) - th * 0.5;
  } else {
    // Side-on: a thin bar.
    d = sdSegment(q, c - vec2(0.0, h), c + vec2(0.0, h)) - th * 0.6;
  }
  return d;
}

vec4 generate(vec2 uv) {
  float t = u_time * u_speed;
  float chains = float(u_chains);
  float cell = floor(uv.x * chains);
  float phase = hash12(vec2(mod(cell, chains), 1.7));
  float Y = uv.y * chains + t * u_scroll;
  // Sway: whole waves per tile height (seamless).
  float sway = sin(TAU * (uv.y * float(u_waves)) + t * 1.5 + phase * TAU) * 0.12 * u_sway;
  vec2 q = vec2(fract(uv.x * chains) - 0.5 - sway, Y);
  float L = 1.0 / float(u_links);
  float k = floor(Y / L);
  float d = 1e3;
  for (int i = -1; i <= 1; i++) {
    float kk = k + float(i);
    d = min(d, chainLink(q, kk, L));
  }
  float aa = 1.5 * chains / u_resolution.x;
  float body = fillMask(d, aa);
  float glow = exp(-max(d, 0.0) / max(0.04 * u_glow, 1e-3)) * u_glow * 0.6;
  // Pulses fade the chain in and out along its length (whole pulses per tile).
  float fade = 0.35 + 0.65 * (0.5 + 0.5 * sin(TAU * uv.y * float(u_pulses) - t * 2.0 + phase * TAU));
  return vec4(vec3(saturate(max(body, glow) * mix(1.0, fade, u_ghostly))), 1.0);
}
