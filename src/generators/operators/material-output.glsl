// Material Output: shows (and exports) its Color input; the 3D Preview panel reads all of its
// inputs (color, normal map, height, roughness) to light the material.
vec4 generate(vec2 uv) {
  return u_has_color ? texture(u_in_color, uv) : vec4(vec3(0.5), 1.0);
}
