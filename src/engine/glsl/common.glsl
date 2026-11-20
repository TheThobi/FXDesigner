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

// uv in [0,1] -> centered coordinates in [-1,1].
vec2 centered(vec2 uv) { return uv * 2.0 - 1.0; }

float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Falloff that is 1 at d=0 and 0 at d>=radius, shaped by `power`.
float radialFalloff(float d, float radius, float power) {
  return pow(saturate(1.0 - d / max(radius, 1e-5)), power);
}
