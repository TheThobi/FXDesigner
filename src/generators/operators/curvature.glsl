// Curvature & Occlusion from a height map: Curvature (convex edges bright, cavities dark
// around 0.5: wear on edges), Occlusion (how much higher the surroundings are: dirt in
// crevices, 1 = open). Radius in px @512; wraps (seamless).
float heightAt(vec2 uv) {
  vec4 c = texture(u_in_height, fract(uv));
  return luminance(c.rgb) * c.a;
}

vec4 generate(vec2 uv) {
  if (!u_has_height) return vec4(0.0);
  float r = u_radius / 512.0;
  float h = heightAt(uv);
  if (u_output == 0) {
    float avg = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * TAU / 8.0;
      avg += heightAt(uv + vec2(cos(a), sin(a)) * r);
    }
    avg /= 8.0;
    return vec4(vec3(saturate(0.5 + (h - avg) * u_intensity * 8.0)), 1.0);
  }
  float occ = 0.0;
  for (int ring = 1; ring <= 3; ring++) {
    float rr = r * float(ring) / 3.0;
    for (int i = 0; i < 8; i++) {
      float a = (float(i) + 0.5 * float(ring)) * TAU / 8.0;
      occ += max(0.0, heightAt(uv + vec2(cos(a), sin(a)) * rr) - h) / float(ring);
    }
  }
  return vec4(vec3(saturate(1.0 - occ * u_intensity * 0.6)), 1.0);
}
