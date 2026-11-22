import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
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
  defaultPost: { alphaMode: 1 },
  presets: [
    {
      name: 'God rays',
      values: {
        count: 12,
        detail: 4,
        sharpness: 6,
        length: 1.6,
        falloff: 1,
        core: 0.1,
        center: [0, 1],
      },
    },
    { name: 'Starburst', values: { count: 64, detail: 2, sharpness: 8, length: 1, core: 0.4 } },
    { name: 'Soft fan', values: { count: 6, detail: 1, sharpness: 1.2, length: 1.4, falloff: 2 } },
    {
      name: 'Spotlight cone',
      values: {
        count: 3,
        detail: 2,
        sharpness: 0.8,
        length: 1.8,
        falloff: 0.8,
        core: 0,
        center: [0, 1],
      },
    },
    {
      name: 'Shimmering crown',
      values: {
        count: 40,
        detail: 5,
        sharpness: 4,
        length: 0.7,
        falloff: 3,
        core: 0.6,
        speed: 1.2,
      },
    },
  ],
  featuredPreset: 'Starburst',
};
