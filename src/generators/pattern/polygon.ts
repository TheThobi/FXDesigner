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
  defaultPost: { alphaMode: 1 },
  presets: [
    { name: 'Star', values: { sides: 5, pointiness: 0.6 } },
    {
      name: 'Hexagon outline',
      values: { sides: 6, pointiness: 0, outline: true, outlineWidth: 0.05, glow: 0.3 },
    },
    { name: 'Spiky gear', values: { sides: 14, pointiness: 0.4, rotation: 10 } },
    {
      name: 'Glowing triangle',
      values: { sides: 3, pointiness: 0, outline: true, outlineWidth: 0.03, glow: 0.8 },
    },
    {
      name: 'Soft diamond',
      values: { sides: 4, pointiness: 0, radius: 0.7, softness: 0.25, rotation: 45 },
    },
    {
      name: 'Spinning sigil',
      values: {
        sides: 8,
        pointiness: 0.8,
        outline: true,
        outlineWidth: 0.02,
        glow: 0.5,
        speed: 0.3,
      },
    },
  ],
  featuredPreset: 'Hexagon outline',
};
