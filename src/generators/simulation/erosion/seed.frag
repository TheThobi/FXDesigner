// Initial terrain (periodic fBm, or the Terrain input). State: r = terrain, g = water,
// b = suspended sediment, a = initial terrain (for the erosion / deposit view).
void main() {
  vec2 uv = gl_FragCoord.xy / u_gridSize;
  float h;
  if (u_has_terrain) {
    vec4 c = texture(u_in_terrain, uv);
    h = luminance(c.rgb) * c.a;
  } else {
    float k = float(u_terrainScale);
    // Aspect-aware cells keep features round on non-square grids (whole periods: seamless).
    vec2 cells = vec2(k) * u_gridSize / min(u_gridSize.x, u_gridSize.y);
    cells = max(vec2(1.0), floor(cells + 0.5));
    float n = fbm(uv * cells, 7, 2.0, 0.5, cells, 0.0, u_ridged ? FBM_RIDGED : FBM_STANDARD);
    h = saturate(n * 0.5 + 0.5);
  }
  outColor = vec4(h, 0.0, 0.0, h);
}
