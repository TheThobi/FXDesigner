import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './explosion.glsl?raw';

export const explosion: ShaderGenerator = {
  kind: 'shader',
  id: 'explosion',
  name: 'Fireball',
  category: 'fire',
  description: 'Billowing explosion / fireball sprite.',
  animated: true,
  fragment,
  params: [
    param.float('radius', 'Radius', 0.75, 0.1, 1.2),
    param.float('turbulence', 'Turbulence', 0.8, 0, 2),
    param.float('falloff', 'Falloff', 0.8, 0.2, 4),
    param.float('coreHeat', 'Core heat', 0.6, 0, 2),
    param.float('scale', 'Noise scale', 4, 1, 12, { group: 'Noise' }),
    param.int('octaves', 'Octaves', 5, 1, 8, { group: 'Noise' }),
    param.speed(0.6, 3),
  ],
  defaultPost: { gradient: GRADIENTS.fire, alphaMode: 1 },
};
