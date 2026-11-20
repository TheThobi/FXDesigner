import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
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
  defaultPost: { alphaMode: 1 },
  presets: [
    { name: 'Laser', values: { width: 0.08, core: 0.6, falloff: 5, flicker: 0.2 } },
    {
      name: 'Energy stream',
      values: { width: 0.5, core: 0.2, falloff: 1.5, flicker: 1, noiseScale: 8, speed: 1.5 },
    },
    {
      name: 'Light pillar',
      values: { width: 0.4, core: 0.3, falloff: 2, endFade: 0.8, vertical: true },
    },
  ],
  featuredPreset: 'Energy stream',
};
