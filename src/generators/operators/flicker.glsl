// Flicker (animation): brightness (or opacity) pulses over time: sine, noise (candle-like) or
// strobe. Local gives each area its own phase, so the image shimmers instead of blinking.
float flickerWave(float t) {
  if (u_wave == 0) return 0.5 + 0.5 * sin(TAU * t);
  if (u_wave == 1) {
    float n = valueNoise(vec2(t * 3.0, 0.5), vec2(0.0));
    return saturate((n - 0.5) * 1.6 + 0.5);
  }
  return step(0.5, fract(t));
}

vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec4 c = texture(u_in_image, uv);
  float phase = u_local * valueNoise(uv * 4.0, vec2(4.0)) * 3.0;
  float k = mix(1.0, flickerWave(u_time * u_speed + phase), u_amount);
  return u_opacity ? vec4(c.rgb, c.a * k) : vec4(c.rgb * k, c.a);
}
