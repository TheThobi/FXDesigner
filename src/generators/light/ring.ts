import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './ring.glsl?raw';

export const ring: ShaderGenerator = {
  kind: 'shader',
  id: 'ring',
  name: 'Ring',
  category: 'light',
  description: 'Glowing ring, shockwave or dashed circle.',
  animated: true,
  fragment,
  params: [
    param.float('radius', 'Radius', 0.6, 0, 1),
    param.float('thickness', 'Thickness', 0.04, 0, 0.5),
    param.float('glow', 'Glow', 0.15, 0, 1),
    param.int('segments', 'Segments', 0, 0, 64, {
      group: 'Segments',
      description: '0 = continuous',
    }),
    param.float('gap', 'Gap', 0.3, 0, 0.95, { group: 'Segments' }),
    param.float('rotationSpeed', 'Rotation speed', 0, -1, 1, { group: 'Segments' }),
    param.float('distortion', 'Distortion', 0, 0, 1, { group: 'Animation' }),
    param.speed(0.5),
  ],
  defaultPost: { alphaMode: 1, gradient: GRADIENTS.whiteFade, colorMode: 0 },
};
