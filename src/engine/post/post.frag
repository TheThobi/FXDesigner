// Post-processing pass: levels -> color ramp -> alpha, or height -> normal map.
// Parameter uniforms are injected from POST_PARAMS (see Renderer).

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_source;
uniform vec2 u_texel;
uniform float u_viewTiles;
uniform bool u_premultiply;

vec3 levels(vec3 c) {
  c = (c - 0.5) * u_contrast + 0.5 + u_brightness;
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / u_gamma));
  return u_invert ? 1.0 - c : c;
}

float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float heightAt(vec2 uv) { return lum(levels(texture(u_source, uv).rgb)); }

vec4 rampColor(float t) {
  // Sample texel centers of the 256-wide ramp.
  return texture(u_gradient, vec2((t * 255.0 + 0.5) / 256.0, 0.5));
}

void main() {
  vec2 uv = fract(v_uv * u_viewTiles);
  vec4 src = texture(u_source, uv);
  vec4 color;

  if (u_output == 1) {
    float hl = heightAt(uv - vec2(u_texel.x, 0.0));
    float hr = heightAt(uv + vec2(u_texel.x, 0.0));
    float hd = heightAt(uv - vec2(0.0, u_texel.y));
    float hu = heightAt(uv + vec2(0.0, u_texel.y));
    // Slope in uv units, so strength is resolution independent.
    vec2 slope = vec2(hl - hr, hd - hu) / (2.0 * u_texel) * (u_normalStrength * 0.01);
    vec3 n = normalize(vec3(slope, 1.0));
    if (u_normalFlipY) n.y = -n.y;
    color = vec4(n * 0.5 + 0.5, 1.0);
  } else {
    vec3 c = levels(src.rgb);
    float l = lum(c);
    color = u_colorMode == 1 ? rampColor(l) : vec4(c, 1.0);
    float alpha = 1.0;
    if (u_alphaMode == 1) alpha = l;
    else if (u_alphaMode == 2) alpha = color.a;
    else if (u_alphaMode == 3) alpha = src.a;
    color.a = alpha;
  }

  if (u_premultiply) color.rgb *= color.a;
  outColor = color;
}
