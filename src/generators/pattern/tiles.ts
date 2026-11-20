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
};
