import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './caustics.glsl?raw';

export const caustics: ShaderGenerator = {
  kind: 'shader',
  id: 'caustics',
  name: 'Caustics',
  category: 'noise',
  description: 'Seamless animated underwater light caustics.',
  animated: true,
  fragment,
  params: [
    param.int('scale', 'Repeat', 1, 1, 8),
    param.int('iterations', 'Iterations', 5, 2, 8),
    param.float('intensity', 'Intensity', 0.005, 0.001, 0.02, { step: 0.0001 }),
    param.float('sharpness', 'Sharpness', 8, 1, 16),
    param.speed(0.5, 3),
  ],
  defaultPost: { gradient: GRADIENTS.ocean },
};
