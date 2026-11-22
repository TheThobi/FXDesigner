// Final image: accumulated caustic light (1 = undisturbed), tone-mapped, or the height field.
uniform sampler2D u_caustics;

void main() {
  if (u_view == 1) {
    float h = sampleState(v_uv).r;
    outColor = vec4(vec3(saturate(0.5 + h * 0.5)), 1.0);
    return;
  }
  // Contrast first (focused light stands out of the ambient level), then soft highlights.
  // Light accumulated per mesh triangle: a light 3x3 tent filter hides the facets.
  vec2 e = 1.0 / vec2(textureSize(u_caustics, 0));
  vec3 light = texture(u_caustics, v_uv).rgb * 0.25;
  light += (texture(u_caustics, v_uv + vec2(e.x, 0.0)).rgb + texture(u_caustics, v_uv - vec2(e.x, 0.0)).rgb +
            texture(u_caustics, v_uv + vec2(0.0, e.y)).rgb + texture(u_caustics, v_uv - vec2(0.0, e.y)).rgb) * 0.125;
  light += (texture(u_caustics, v_uv + e).rgb + texture(u_caustics, v_uv - e).rgb +
            texture(u_caustics, v_uv + vec2(e.x, -e.y)).rgb + texture(u_caustics, v_uv - vec2(e.x, -e.y)).rgb) * 0.0625;
  vec3 v = 1.0 - exp(-pow(max(light, 0.0), vec3(u_sharpness)) * u_brightness * 0.4);
  outColor = vec4(v, 1.0);
}
