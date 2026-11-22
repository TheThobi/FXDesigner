// Refracted light mesh (after Evan Wallace's WebGL Water): a grid covering the water surface,
// each vertex displaced on the floor along the refracted ray (∝ surface slope). 9 instances
// shifted by ±1 so light leaving one side of the tile lands on the other (seamless).
// The surface is the simulated height plus an analytic swell (periodic noise, `u_wind`).
// Prepended by the simulation: header, u_seed, common + noise chunks.
uniform sampler2D u_state;
uniform float u_swellTime;
uniform float u_wind;
uniform float u_windScale;
uniform int u_mesh;       // cells per side
uniform float u_depth;    // floor distance (displacement scale)
uniform float u_eta;      // per-channel refraction multiplier (dispersion)

out vec2 v_old;
out vec2 v_new;

float heightAt(ivec2 p) {
  ivec2 size = textureSize(u_state, 0);
  // Floor-based wrap: `%` on negative ints is undefined in GLSL ES.
  ivec2 q = p - size * ivec2(floor(vec2(p) / vec2(size)));
  return texelFetch(u_state, q, 0).r;
}

// Bilinear height (float textures are not filterable).
float heightUv(vec2 uv) {
  vec2 p = uv * vec2(textureSize(u_state, 0)) - 0.5;
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  return mix(mix(heightAt(i), heightAt(i + ivec2(1, 0)), f.x),
             mix(heightAt(i + ivec2(0, 1)), heightAt(i + ivec2(1, 1)), f.x), f.y);
}

// Periodic swell. The domain is warped by a low-frequency noise and the octaves are offset,
// so the lattice of the gradient noise (and the tile repeat) doesn't show.
float swell(vec2 uv) {
  float s = u_windScale;
  float t = u_swellTime;
  vec2 warp = vec2(gradientNoise(uv * 2.0 + 3.1, vec2(2.0), t * 0.3),
                   gradientNoise(uv * 2.0 + 7.7, vec2(2.0), t * 0.3)) * 0.6;
  vec2 p = uv * s + warp;
  float n = gradientNoise(p + vec2(t * 0.15, 0.0), vec2(s), t)
          + 0.55 * gradientNoise(p * 2.0 + vec2(0.37, 0.71) - vec2(0.0, t * 0.2), vec2(s * 2.0), t * 1.7)
          + 0.25 * gradientNoise(p * 4.0 + vec2(0.83, 0.19), vec2(s * 4.0), t * 2.3);
  return n * u_wind * 3.0;
}

float surface(vec2 uv) { return heightUv(uv) + swell(uv); }

void main() {
  const ivec2 corners[6] = ivec2[6](
    ivec2(0, 0), ivec2(1, 0), ivec2(0, 1), ivec2(0, 1), ivec2(1, 0), ivec2(1, 1));
  int cell = gl_VertexID / 6;
  ivec2 c = ivec2(cell - (cell / u_mesh) * u_mesh, cell / u_mesh) + corners[gl_VertexID - cell * 6];
  vec2 uv = vec2(c) / float(u_mesh);
  float e = 1.0 / float(textureSize(u_state, 0).x);
  // Slope per texel: resolution independent displacement.
  vec2 slope = 0.5 * vec2(surface(uv + vec2(e, 0.0)) - surface(uv - vec2(e, 0.0)),
                          surface(uv + vec2(0.0, e)) - surface(uv - vec2(0.0, e)));
  vec2 shift = vec2(float(gl_InstanceID % 3 - 1), float(gl_InstanceID / 3 - 1));
  v_old = uv;
  v_new = uv - slope * u_depth * u_eta * 0.12 + shift;
  gl_Position = vec4(v_new * 2.0 - 1.0, 0.0, 1.0);
}
