import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './lightning.glsl?raw';

export const lightning: ShaderGenerator = {
  kind: 'shader',
  id: 'lightning',
  name: 'Lightning',
  category: 'light',
  description: 'Electric bolts; re-strikes over time.',
  animated: true,
  fragment,
  params: [
    param.int('bolts', 'Bolts', 2, 1, 6),
    param.float('amplitude', 'Amplitude', 0.5, 0, 1.5),
    param.float('frequency', 'Frequency', 2, 0.5, 8),
    param.int('octaves', 'Jaggedness', 6, 1, 8),
    param.float('thickness', 'Thickness', 0.012, 0.001, 0.08),
    param.float('glow', 'Glow', 0.15, 0, 0.6),
    param.float('strikeRate', 'Strikes / s', 4, 0, 30, { group: 'Animation' }),
  ],
  defaultPost: { alphaMode: 1, gradient: GRADIENTS.electric },
};
