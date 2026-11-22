import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './custom-shader.glsl?raw';

/**
 * Starting point for hand-written GLSL: four generic sliders and a color as uniforms. Its node
 * opens in the Code view; like any shader node, edited code makes it a custom node.
 */
export const customShader: ShaderGenerator = {
  kind: 'shader',
  id: 'custom-shader',
  name: 'Custom Shader',
  category: 'pattern',
  description:
    'Your own GLSL generator: edit generate(uv) in the Code view. Sliders A–D and Color are ' +
    'the uniforms u_a … u_d and u_color.',
  animated: true,
  fragment,
  params: [
    param.float('a', 'A', 0.5, 0, 1),
    param.float('b', 'B', 0.3, 0, 1),
    param.float('c', 'C', 0.5, 0, 1),
    param.float('d', 'D', 0.2, 0, 1),
    param.color('color', 'Color', '#ffffff'),
  ],
  presets: [
    { name: 'Thin ring', values: { a: 0.6, b: 0.2, c: 0.2, d: 0 } },
    { name: 'Noisy halo', values: { a: 0.4, b: 0.6, c: 1, d: 0.5 } },
    { name: 'Cloud field', values: { a: 0, b: 0.3, c: 0, d: 1 } },
  ],
  featuredPreset: 'Noisy halo',
};
