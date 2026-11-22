#version 300 es
// Light intensity = area of the surface patch / area of its projection on the floor: light
// focused into a smaller area gets brighter. 1.0 everywhere for a flat surface.
precision highp float;

in vec2 v_old;
in vec2 v_new;
out vec4 outColor;

uniform vec3 u_channel;

void main() {
  float oldArea = length(dFdx(v_old)) * length(dFdy(v_old));
  float newArea = length(dFdx(v_new)) * length(dFdy(v_new));
  float k = oldArea / max(newArea, 1e-12);
  outColor = vec4(u_channel * min(k, 60.0), 1.0);
}
