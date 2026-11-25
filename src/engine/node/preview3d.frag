// 3D preview shading: albedo, normals from a normal map or from the height's luminance,
// roughness (glossy → dull highlight), one directional light. Back faces of closed shapes are discarded (no depth buffer needed for
// convex shapes); the plane is two-sided. Additive mode shows the image as a glowing sprite.
in vec3 v_pos;
in vec3 v_normal;
in vec3 v_tangent;
in vec3 v_bitangent;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_color;
uniform sampler2D u_height;
uniform sampler2D u_normal;
uniform sampler2D u_roughness;
uniform bool u_hasNormal;
uniform bool u_hasRoughness;
uniform float u_roughnessValue;
uniform vec3 u_eye;
uniform vec3 u_light;
uniform float u_relief;
uniform float u_tiles;
uniform bool u_twoSided;
uniform bool u_additive;

float heightAt(vec2 uv) { return dot(texture(u_height, uv).rgb, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec3 V = normalize(u_eye - v_pos);
  vec3 N = normalize(v_normal);
  vec3 T = normalize(v_tangent);
  vec3 B = normalize(v_bitangent);
  if (dot(N, V) < 0.0) {
    if (!u_twoSided) discard;
    N = -N;
  }
  vec2 uv = v_uv * u_tiles;
  vec4 albedo = texture(u_color, uv);
  if (u_additive) {
    outColor = vec4(albedo.rgb * albedo.a, 1.0);
    return;
  }
  vec3 n;
  if (u_hasNormal) {
    // Tangent-space normal map; Relief scales its slopes.
    vec3 t = texture(u_normal, uv).rgb * 2.0 - 1.0;
    n = normalize(T * t.x * u_relief + B * t.y * u_relief + N * max(t.z, 0.05));
  } else {
    vec2 texel = 1.0 / vec2(textureSize(u_height, 0));
    // Height gradient per uv unit, scaled to the surface (about 2 units per texture repeat).
    float hx = (heightAt(uv + vec2(texel.x, 0.0)) - heightAt(uv - vec2(texel.x, 0.0))) / (2.0 * texel.x);
    float hy = (heightAt(uv + vec2(0.0, texel.y)) - heightAt(uv - vec2(0.0, texel.y))) / (2.0 * texel.y);
    float k = u_relief * 0.02 * u_tiles;
    n = normalize(N - (T * hx + B * hy) * k);
  }
  float rough = u_hasRoughness
    ? dot(texture(u_roughness, uv).rgb, vec3(0.2126, 0.7152, 0.0722))
    : u_roughnessValue;
  vec3 L = normalize(u_light);
  float diffuse = max(dot(n, L), 0.0);
  float shininess = mix(96.0, 6.0, rough);
  float spec = pow(max(dot(n, normalize(L + V)), 0.0), shininess) * mix(0.6, 0.04, rough);
  float sky = 0.5 + 0.5 * n.y;
  vec3 rgb = albedo.rgb * (0.18 + 0.12 * sky + 0.85 * diffuse) + spec;
  outColor = vec4(clamp(rgb, 0.0, 1.0), albedo.a);
}
