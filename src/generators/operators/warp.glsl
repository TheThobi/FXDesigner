// Warp: displaces the Image by the Warp input. Slope: along the luminance gradient (Substance
// "Warp"); Vector: RG encoded around 0.5 (flowmaps); Directional: along a fixed angle, by
// luminance (Substance "Directional Warp").
float warpLum(vec2 uv) {
  vec4 c = texture(u_in_warp, uv);
  return luminance(c.rgb) * c.a;
}

vec4 generate(vec2 uv) {
  if (!u_has_image) return vec4(0.0);
  vec2 offset = vec2(0.0);
  if (u_has_warp) {
    if (u_mode == 0) {
      float e = 1.0 / 128.0;
      offset = vec2(warpLum(uv + vec2(e, 0.0)) - warpLum(uv - vec2(e, 0.0)),
                    warpLum(uv + vec2(0.0, e)) - warpLum(uv - vec2(0.0, e))) * u_intensity;
    } else if (u_mode == 1) {
      vec4 f = texture(u_in_warp, uv);
      offset = (f.rg * 2.0 - 1.0) * f.a * u_intensity * 0.25;
    } else {
      float a = radians(u_angle);
      offset = vec2(cos(a), sin(a)) * (warpLum(uv) - 0.5) * u_intensity * 0.25;
    }
  }
  return texture(u_in_image, fract(uv + offset));
}
