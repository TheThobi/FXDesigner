// Tile Sampler (after Substance Designer, animated): copies of the Shape input scattered on
// a seamless grid, each with random offset, scale, rotation and brightness; the Mask input
// thins them out. Unlike Substance, copies move: the grid drifts, copies spin, wobble,
// pulse, twinkle or live a pop-in / fade-out cycle, each with its own phase. Every motion is
// a whole number of turns per loop (loopFlow): the animation loops natively.
vec4 shapeAt(vec2 local) {
  if (any(lessThan(local, vec2(0.0))) || any(greaterThan(local, vec2(1.0)))) return vec4(0.0);
  return u_has_shape ? texture(u_in_shape, local) : vec4(vec3(1.0 - smoothstep(0.4, 0.5, length(local - 0.5))), 1.0);
}

vec4 generate(vec2 uv) {
  float n = float(u_count);
  // Drift: the whole grid scrolls (whole cells per loop).
  vec2 drift = vec2(loopFlow(u_driftX * TAU), loopFlow(u_driftY * TAU)) / TAU;
  vec2 g = uv * n - drift;
  vec2 cell = floor(g);
  float cycle = loopFlow(u_animSpeed * TAU);
  vec4 acc = vec4(0.0);
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 c = cell + vec2(float(x), float(y));
      vec2 id = mod(c, n);
      vec2 r = hash22(id + 0.37);
      vec2 r2 = hash22(id + 7.91);
      vec2 r3 = hash22(id + 4.47);
      float phase = cycle + r3.x * TAU;
      // Density and mask (sampled where the copy currently is).
      float keep = u_density;
      if (u_has_mask) {
        vec4 m = texture(u_in_mask, fract((c + 0.5 + drift) / n));
        keep *= luminance(m.rgb) * m.a;
      }
      if (hash12(id + 3.3) >= keep) continue;
      vec2 center = c + 0.5 + (r - 0.5) * u_jitter;
      center += vec2(cos(phase), sin(phase)) * u_wobble;
      float scale = u_scale * mix(1.0, 0.25 + 1.5 * r2.x, u_scaleRandom);
      scale *= 1.0 + u_pulse * 0.5 * sin(phase * 2.0);
      // Life cycle: grows in, holds, fades out, once per cycle.
      float life = fract(phase / TAU);
      float env = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.6, 1.0, life));
      scale *= mix(1.0, env, u_lifecycle);
      float spinRate = radians(u_spin) * (1.0 + (r3.y * 2.0 - 1.0) * u_spinRandom * 1.5);
      float angle = radians(u_rotation + (r2.y - 0.5) * 2.0 * u_rotationRandom) + loopFlow(spinRate);
      vec2 local = rotate2d(g - center, -angle) / max(scale, 1e-3) + 0.5;
      vec4 s = shapeAt(local);
      float lum = mix(1.0, hash12(id + 5.1), u_lumRandom);
      lum *= 1.0 - u_twinkle * (0.5 + 0.5 * sin(phase * 3.0));
      lum *= mix(1.0, env, u_lifecycle);
      s.rgb *= lum;
      if (u_combine == 0) {
        if (luminance(s.rgb) * s.a > luminance(acc.rgb) * acc.a) acc = s;
      } else {
        acc = vec4(acc.rgb + s.rgb * s.a, max(acc.a, s.a));
      }
    }
  }
  return u_combine == 0 ? acc : vec4(saturate(acc.rgb), acc.a);
}
