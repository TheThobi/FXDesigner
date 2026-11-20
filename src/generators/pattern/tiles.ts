import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './tiles.glsl?raw';

export const tiles: ShaderGenerator = {
  kind: 'shader',
  id: 'tiles',
  name: 'Tiles',
  category: 'pattern',
  description: 'Checker, stripes, dots and grid patterns.',
  animated: false,
  fragment,
  params: [
    param.select('pattern', 'Pattern', ['Checker', 'Stripes', 'Dots', 'Grid']),
    param.int('tiles', 'Tiles', 8, 1, 64),
    param.float('size', 'Size', 0.5, 0, 1, { description: 'Stripe / dot / line width.' }),
    param.float('softness', 'Softness', 0.02, 0, 0.5),
    param.float('rotation', 'Rotation', 0, 0, 360),
  ],
  presets: [
    { name: 'Polka dots', values: { pattern: 2, tiles: 10, size: 0.5, softness: 0.05 } },
    { name: 'Diagonal stripes', values: { pattern: 1, tiles: 12, rotation: 45 } },
    { name: 'Fine grid', values: { pattern: 3, tiles: 16, size: 0.1 } },
  ],
  featuredPreset: 'Polka dots',
};
