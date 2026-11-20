// ---- sdf: 2D signed distance helpers ----------------------------------------------------------

// Star / regular polygon (after Inigo Quilez). `n` points, outer radius `r`,
// `m` in [2, n] controls pointiness: m = 2 gives a regular polygon.
float sdStar(vec2 p, float r, int n, float m) {
  float an = PI / float(n);
  float en = PI / m;
  vec2 acs = vec2(cos(an), sin(an));
  vec2 ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}

float sdCircle(vec2 p, float r) { return length(p) - r; }

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Anti-aliased fill (inside d < 0).
float fillMask(float d, float aa) { return 1.0 - smoothstep(-aa, aa, d); }

// Anti-aliased line of total `width` centered on the d = 0 isoline.
float strokeMask(float d, float width, float aa) {
  return 1.0 - smoothstep(width * 0.5, width * 0.5 + aa, abs(d));
}
