import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './gradient.glsl?raw';

export const gradientGenerator: ShaderGenerator = {
  kind: 'shader',
  id: 'gradient',
  name: 'Gradient',
  category: 'pattern',
  description: 'Linear, radial, angular, diamond and square ramps.',
  animated: false,
  fragment,
  params: [
    param.select('shape', 'Shape', ['Linear', 'Radial', 'Angular', 'Diamond', 'Square']),
    param.float('angle', 'Angle', 0, 0, 360),
    param.float('scale', 'Scale', 1, 0.1, 8),
    param.float('offset', 'Offset', 0, -1, 1),
    param.select('repeat', 'Repeat', ['Clamp', 'Repeat', 'Mirror']),
    param.vec2('center', 'Center', [0, 0], -1, 1),
  ],
};
