import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './light-rays.glsl?raw';

export const lightRays: ShaderGenerator = {
  kind: 'shader',
  id: 'light-rays',
  name: 'Light Rays',
  category: 'light',
  description: 'Sunburst / god rays radiating from a center.',
  animated: true,
  fragment,
  params: [
    param.int('count', 'Ray frequency', 24, 2, 96),
    param.int('detail', 'Detail', 3, 1, 6),
    param.float('sharpness', 'Sharpness', 3, 0.5, 10),
    param.float('length', 'Length', 1.2, 0.1, 2),
    param.float('falloff', 'Falloff', 1.5, 0.2, 6),
    param.float('core', 'Core size', 0.25, 0, 1),
    param.vec2('center', 'Center', [0, 0], -1, 1),
    param.speed(0.3, 2),
  ],
  defaultPost: { alphaMode: 1, gradient: GRADIENTS.whiteFade, colorMode: 0 },
};
