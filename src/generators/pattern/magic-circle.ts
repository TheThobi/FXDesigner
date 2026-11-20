import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './magic-circle.glsl?raw';

export const magicCircle: ShaderGenerator = {
  kind: 'shader',
  id: 'magic-circle',
  name: 'Magic Circle',
  category: 'pattern',
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
  defaultPost: { alphaMode: 1, gradient: GRADIENTS.magic },
};
