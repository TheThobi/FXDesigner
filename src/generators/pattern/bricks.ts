import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './bricks.glsl?raw';

export const bricks: ShaderGenerator = {
  kind: 'shader',
  id: 'bricks',
  name: 'Bricks',
  category: 'pattern',
  description: 'Seamless bricks / tiles height map. Try Output → Normal map.',
  animated: false,
  fragment,
  params: [
    param.int('columns', 'Columns', 4, 1, 32),
    param.int('rows', 'Rows', 8, 1, 64),
    param.float('offset', 'Row offset', 0.5, 0, 1),
    param.float('mortar', 'Mortar', 0.2, 0, 1),
    param.float('bevel', 'Bevel', 0.3, 0, 1),
    param.float('variation', 'Color variation', 0.3, 0, 1),
    param.float('noise', 'Surface noise', 0.3, 0, 1),
  ],
};
