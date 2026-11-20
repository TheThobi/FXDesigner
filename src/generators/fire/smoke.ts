import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './smoke.glsl?raw';

export const smoke: ShaderGenerator = {
  kind: 'shader',
  id: 'smoke',
  name: 'Smoke Puff',
  category: 'fire',
  description: 'Soft cloud / smoke particle with alpha.',
  animated: true,
  fragment,
  params: [
    param.float('radius', 'Radius', 0.8, 0.1, 1.2),
    param.float('softness', 'Softness', 0.7, 0, 1),
    param.float('density', 'Density', 1, 0, 2),
    param.float('detail', 'Detail', 0.7, 0, 1),
    param.float('turbulence', 'Turbulence', 0.4, 0, 1.5),
    param.float('scale', 'Noise scale', 3, 1, 12, { group: 'Noise' }),
    param.int('octaves', 'Octaves', 5, 1, 8, { group: 'Noise' }),
    param.speed(0.2, 2),
  ],
  defaultPost: { alphaMode: 1 },
  presets: [
    {
      name: 'Toon smoke',
      values: { detail: 0.5, octaves: 3 },
      post: { colorMode: 1, posterize: 3, gradient: GRADIENTS.lavender, outline: 0.8 },
    },
    {
      name: 'Thick plume',
      values: { radius: 0.9, softness: 0.4, density: 1.6, detail: 0.9, turbulence: 0.8 },
    },
    { name: 'Haze', values: { radius: 1.1, softness: 1, density: 0.6, detail: 0.4 } },
  ],
  featuredPreset: 'Thick plume',
};
