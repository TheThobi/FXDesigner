// Smoke pass 1: forces on the velocity, and density sources (FluidNinja-style solver):
//   vorticity confinement (re-injects the small swirls numerical diffusion kills), buoyancy
//   along the up direction, curl-noise turbulence, emitters (shape, Emitter input, brush),
//   Flow input (flowmap pushing the fluid), open boundaries.
float curlAt(ivec2 p) {
  return (stateAt(p + ivec2(1, 0)).g - stateAt(p - ivec2(1, 0)).g) -
         (stateAt(p + ivec2(0, 1)).r - stateAt(p - ivec2(0, 1)).r);
}

// Emitter position, orbiting around `emitterPos` when orbitRadius > 0 (trails).
vec2 emitterCenter() {
  float a = u_frame / 60.0 * u_orbitSpeed * TAU;
  return fract(u_emitterPos + u_orbitRadius * vec2(cos(a), sin(a)));
}

float emitterShape(vec2 uv) {
  vec2 d = wrapDelta(uv, emitterCenter());
  float r = max(u_emitterSize, 1e-3);
  if (u_emitter == 0) return exp(-dot(d, d) / (r * r));
  if (u_emitter == 1) return exp(-d.y * d.y / (r * r * 0.25)) * smoothstep(r * 4.0, r * 3.0, abs(d.x));
  if (u_emitter == 2) {
    float ring = length(d) - r * 2.0;
    return exp(-ring * ring / (r * r * 0.15));
  }
  return 0.0;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 s = stateAt(p);
  vec2 vel = s.rg;
  float dens = s.a;
  vec2 uv = v_uv;
  float a = radians(u_upAngle);
  vec2 up = vec2(sin(a), cos(a));

  // Vorticity confinement: push along N x curl, N = normalized gradient of |curl|.
  float c = curlAt(p);
  vec2 grad = 0.5 * vec2(abs(curlAt(p + ivec2(1, 0))) - abs(curlAt(p - ivec2(1, 0))),
                         abs(curlAt(p + ivec2(0, 1))) - abs(curlAt(p - ivec2(0, 1))));
  float g = length(grad);
  if (g > 1e-6) {
    vec2 n = grad / g;
    vel += u_vorticity * 0.2 * vec2(n.y, -n.x) * c;
  }

  vel += up * dens * u_buoyancy * 0.04;
  if (u_turbulence > 0.0) {
    vec2 period = vec2(u_turbulenceScale);
    vel += curlNoise(uv * u_turbulenceScale, period, u_frame * 0.006, 2) * u_turbulence * 0.012;
  }

  // Emission: steady, or periodic puffs.
  float pulse = 1.0;
  if (u_puffRate > 0.0) {
    float phase = fract(u_frame * u_puffRate / 60.0);
    pulse = smoothstep(0.35, 0.0, phase);
  }
  float e = emitterShape(uv) * pulse;
  if (u_has_emitter) {
    vec4 t = texture(u_in_emitter, uv);
    e = max(e, clamp(dot(t.rgb, vec3(0.2126, 0.7152, 0.0722)) * t.a, 0.0, 1.0) * pulse);
  }
  dens = max(dens, e * u_emission);
  vel += up * e * u_emitSpeed * 0.8;

  if (u_has_flow) {
    vec4 f = texture(u_in_flow, uv);
    vel += (f.rg * 2.0 - 1.0) * f.a * u_flowStrength * 0.05;
  }

  int brush = brushMode();
  if (brush != 0) {
    vec2 d = wrapDelta(uv, u_brush.xy);
    float f = exp(-dot(d, d) / (u_brush.z * u_brush.z));
    if (brush == 1) {
      vel += u_brushDir * u_gridSize * f * 0.4;
      dens = mix(dens, 1.0, f * 0.6);
    } else {
      dens *= 1.0 - f;
    }
  }

  // Open boundaries: fluid fades out near the edges instead of wrapping around.
  if (u_boundaries == 1) {
    vec2 edge = min(uv, 1.0 - uv);
    float k = smoothstep(0.0, 0.04, min(edge.x, edge.y));
    dens *= k;
    vel *= mix(0.9, 1.0, k);
  }
  outColor = vec4(vel, s.b, dens);
}
