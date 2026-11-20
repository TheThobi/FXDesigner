import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './beam.glsl?raw';

export const beam: ShaderGenerator = {
  kind: 'shader',
  id: 'beam',
  name: 'Beam',
  category: 'light',
  description: 'Laser / energy beam with flickering width. Seamless along its axis.',
  animated: true,
  fragment,
  params: [
    param.float('width', 'Width', 0.25, 0.01, 1),
    param.float('core', 'Core ratio', 0.25, 0, 1),
    param.float('falloff', 'Falloff', 2, 0.3, 8),
    param.float('flicker', 'Flicker', 0.5, 0, 1),
    param.float('noiseScale', 'Flicker frequency', 4, 1, 16),
    param.float('endFade', 'End fade', 0, 0, 1),
    param.bool('vertical', 'Vertical', false),
    param.speed(0.5),
  ],
  defaultPost: { alphaMode: 1, gradient: GRADIENTS.electric },
};
