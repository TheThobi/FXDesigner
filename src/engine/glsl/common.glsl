// ---- common: constants and small helpers ----------------------------------------------------
#define PI 3.14159265359
#define TAU 6.28318530718

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }

// Counter-clockwise rotation by `a` radians.
vec2 rotate2d(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Aspect correction of centered(): set by generator main() for non-square workspaces (the
// long axis extends beyond [-1, 1] so centered shapes stay round). 1 elsewhere.
vec2 g_centerScale = vec2(1.0);

// uv in [0,1] -> centered coordinates in [-1,1] (along the short axis).
vec2 centered(vec2 uv) { return (uv * 2.0 - 1.0) * g_centerScale; }

float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Falloff that is 1 at d=0 and 0 at d>=radius, shaped by `power`.
float radialFalloff(float d, float radius, float power) {
  return pow(saturate(1.0 - d / max(radius, 1e-5)), power);
}

// Random variation of a color (r in [0,1]^3): value change plus a slight hue drift.
vec3 jitterColor(vec3 c, vec3 r, float amount) {
  return clamp(c * (1.0 + (r.x - 0.5) * amount) + (r - 0.5) * amount * 0.25, 0.0, 1.0);
}
