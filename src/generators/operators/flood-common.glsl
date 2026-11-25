// Flood Fill data (from a Flood Fill node set to Data): R, G = position in the island's box,
// B, A = box size (uv); A = 0 on the lines between islands.
// Nearest texel: interpolating between two islands' data would mix their boxes.
vec4 ffData(vec2 uv) {
  if (!u_has_data) return vec4(0.0);
  ivec2 size = textureSize(u_in_data, 0);
  return texelFetch(u_in_data, clamp(ivec2(fract(uv) * vec2(size)), ivec2(0), size - 1), 0);
}

bool ffIsland(vec4 d) {
  return d.a > 1e-5;
}

// Random value of the island (the same for all its pixels).
float ffRandom(vec4 d, vec2 uv, float salt) {
  vec2 size = vec2(textureSize(u_in_data, 0));
  vec2 corner = fract(uv - d.rg * d.ba);
  return hash12(mod(floor(corner * size + 0.5), size) * 0.917 + salt);
}

// Center of the island's box (uv).
vec2 ffCenter(vec4 d, vec2 uv) {
  return fract(uv - (d.rg - 0.5) * d.ba);
}
