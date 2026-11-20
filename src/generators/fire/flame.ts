import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './flame.glsl?raw';

export const flame: ShaderGenerator = {
  kind: 'shader',
  id: 'flame',
  name: 'Flame',
  category: 'fire',
  description: 'Rising flame with turbulent licks. Pair with the Fire ramp.',
  animated: true,
  fragment,
  params: [
    param.float('width', 'Width', 0.55, 0.05, 1.5, { group: 'Shape' }),
    param.float('height', 'Height', 0.9, 0.2, 1.2, { group: 'Shape' }),
    param.float('taper', 'Taper', 0.8, 0.1, 3, { group: 'Shape' }),
    param.float('intensity', 'Intensity', 1.2, 0, 3, { group: 'Shape' }),
    param.float('scale', 'Noise scale', 5, 1, 16, { group: 'Noise' }),
    param.int('octaves', 'Octaves', 5, 1, 8, { group: 'Noise' }),
    param.float('turbulence', 'Turbulence', 0.6, 0, 2, { group: 'Noise' }),
    param.speed(1, 4),
  ],
  defaultPost: { gradient: GRADIENTS.fire, alphaMode: 1 },
};
