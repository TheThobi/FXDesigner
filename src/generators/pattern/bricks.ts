import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './bricks.glsl?raw';

export const bricks: ShaderGenerator = {
  kind: 'shader',
  id: 'bricks',
  name: 'Bricks',
  category: 'material',
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
  presets: [
    { name: 'Old wall', values: { columns: 4, rows: 8, bevel: 0.5, variation: 0.7, noise: 0.7 } },
    {
      name: 'Stack bond tiles',
      values: { columns: 6, rows: 6, offset: 0, mortar: 0.1, bevel: 0.2 },
    },
    {
      name: 'Long planks',
      values: { columns: 2, rows: 12, offset: 0.33, mortar: 0.05, variation: 0.5, noise: 0.5 },
    },
  ],
  featuredPreset: 'Old wall',
};
