import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './glow.glsl?raw';

export const glow: ShaderGenerator = {
  kind: 'shader',
  id: 'glow',
  name: 'Glow',
  category: 'light',
  description: 'Radial light falloff, the base of most particle sprites.',
  animated: true,
  fragment,
  params: [
    param.float('radius', 'Radius', 0.9, 0.05, 1.5),
    param.float('falloff', 'Falloff', 2.5, 0.3, 8),
    param.float('intensity', 'Intensity', 1, 0, 3),
    param.float('core', 'Core size', 0.08, 0, 0.5),
    param.vec2('center', 'Center', [0, 0], -1, 1),
    param.float('distortion', 'Distortion', 0, 0, 1, { group: 'Animation' }),
    param.speed(0.5),
  ],
  defaultPost: { alphaMode: 1 },
  presets: [
    { name: 'Hot core', values: { radius: 0.6, falloff: 4, intensity: 1.6, core: 0.25 } },
    { name: 'Soft halo', values: { radius: 1.3, falloff: 1.2, intensity: 0.8, core: 0 } },
    { name: 'Unstable orb', values: { radius: 0.8, falloff: 2, distortion: 0.7, speed: 2 } },
  ],
  featuredPreset: 'Unstable orb',
};
