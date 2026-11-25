// Flood Fill Mapper: the Pattern placed in every island's box (stretched to it), with random
// quarter turns, mirroring and brightness per island: varied stone faces, planks, tiles.
vec4 generate(vec2 uv) {
  vec4 d = ffData(uv);
  if (!ffIsland(d)) return vec4(vec3(0.0), u_keepLines ? 1.0 : 0.0);
  vec2 p = (d.rg - 0.5) / max(u_scale, 1e-3);
  if (ffRandom(d, uv, 6.0) < u_rotateRandom) {
    float turns = floor(ffRandom(d, uv, 7.0) * 4.0);
    p = rotate2d(p, turns * TAU * 0.25);
  }
  if (ffRandom(d, uv, 8.0) < u_mirrorRandom) p.x = -p.x;
  // A random offset so repeated patterns don't align.
  vec2 offset = vec2(ffRandom(d, uv, 9.0), ffRandom(d, uv, 10.0)) * u_offsetRandom;
  vec4 c = u_has_pattern
    ? texture(u_in_pattern, fract(p + 0.5 + offset))
    : vec4(vec3(1.0 - length(p) * 1.4), 1.0);
  c.rgb *= mix(1.0, 0.6 + 0.8 * ffRandom(d, uv, 11.0), u_lumRandom);
  return vec4(saturate(c.rgb), c.a);
}
