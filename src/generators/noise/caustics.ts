import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './caustics.glsl?raw';

export const caustics: ShaderGenerator = {
  kind: 'shader',
  id: 'caustics',
  name: 'Caustics',
  category: 'water',
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

  presets: [
    {
      name: 'Sharp caustics',
      values: { sharpness: 4 },
      ramp: GRADIENTS.azure,
    },
    { name: 'Pool floor', values: { scale: 2, iterations: 6, intensity: 0.006, sharpness: 10 } },
    { name: 'Soft light', values: { scale: 1, iterations: 4, intensity: 0.01, sharpness: 3 } },
    { name: 'Fine net', values: { scale: 4, iterations: 8, intensity: 0.004, sharpness: 14 } },
  ],
  featuredPreset: 'Pool floor',
};
