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
  presets: [
    { name: 'Radial', values: { shape: 1 } },
    { name: 'Angular sweep', values: { shape: 2 } },
    { name: 'Repeated stripes', values: { shape: 0, scale: 6, repeat: 2, angle: 45 } },
    { name: 'Diamond', values: { shape: 3, scale: 1.5 } },
  ],
  featuredPreset: 'Angular sweep',
};
