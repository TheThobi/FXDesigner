import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './polygon.glsl?raw';

export const polygon: ShaderGenerator = {
  kind: 'shader',
  id: 'polygon',
  name: 'Polygon / Star',
  category: 'pattern',
  description: 'Regular polygons and stars, filled or outlined.',
  animated: true,
  fragment,
  params: [
    param.int('sides', 'Points', 5, 3, 16),
    param.float('pointiness', 'Pointiness', 0.6, 0, 0.95, {
      description: '0 = polygon, higher = star.',
    }),
    param.float('radius', 'Radius', 0.8, 0.05, 1),
    param.float('softness', 'Softness', 0.005, 0, 0.3),
    param.bool('outline', 'Outline only', false),
    param.float('outlineWidth', 'Outline width', 0.04, 0.002, 0.3),
    param.float('glow', 'Glow', 0, 0, 1),
    param.float('rotation', 'Rotation', 0, 0, 360),
    param.speed(0, 2),
  ],
  defaultPost: { alphaMode: 1, colorMode: 0 },
};
