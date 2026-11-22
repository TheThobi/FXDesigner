import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './magic-circle.glsl?raw';

export const magicCircle: ShaderGenerator = {
  kind: 'shader',
  id: 'magic-circle',
  name: 'Magic Circle',
  category: 'light',
  description: 'Summoning-circle decal: rings, ticks, star, orbiting dots.',
  animated: true,
  fragment,
  params: [
    param.int('sides', 'Star points', 6, 3, 12),
    param.float('pointiness', 'Pointiness', 0.7, 0, 0.95),
    param.int('ticks', 'Ticks', 72, 0, 180),
    param.float('innerRadius', 'Inner radius', 0.35, 0.1, 0.6),
    param.float('lineWidth', 'Line width', 0.012, 0.002, 0.05),
    param.float('glow', 'Glow', 0.2, 0, 1),
    param.speed(0.2, 2),
  ],
  defaultPost: { alphaMode: 1 },
  presets: [
    { name: 'Summoning', values: { sides: 5, pointiness: 0.8, ticks: 120, glow: 0.4 } },
    {
      name: 'Hex seal',
      values: { sides: 6, pointiness: 0, ticks: 36, innerRadius: 0.45, lineWidth: 0.02 },
    },
    {
      name: 'Delicate',
      values: { sides: 8, pointiness: 0.9, ticks: 180, lineWidth: 0.005, glow: 0.1 },
    },
  ],
  featuredPreset: 'Summoning',
};
