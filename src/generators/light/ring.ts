import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './ring.glsl?raw';

export const ring: ShaderGenerator = {
  kind: 'shader',
  id: 'ring',
  name: 'Ring',
  category: 'light',
  description: 'Glowing ring, shockwave or dashed circle.',
  animated: true,
  fragment,
  params: [
    param.float('radius', 'Radius', 0.6, 0, 1),
    param.float('thickness', 'Thickness', 0.04, 0, 0.5),
    param.float('glow', 'Glow', 0.15, 0, 1),
    param.int('segments', 'Segments', 0, 0, 64, {
      group: 'Segments',
      description: '0 = continuous',
    }),
    param.float('gap', 'Gap', 0.3, 0, 0.95, { group: 'Segments' }),
    param.float('rotationSpeed', 'Rotation speed', 0, -1, 1, { group: 'Segments' }),
    param.float('distortion', 'Distortion', 0, 0, 1, { group: 'Animation' }),
    param.speed(0.5),
  ],
  defaultPost: { alphaMode: 1 },
  presets: [
    { name: 'Halo', values: { radius: 0.7, thickness: 0.02, glow: 0.5 } },
    {
      name: 'Dashed rune ring',
      values: { thickness: 0.05, segments: 24, gap: 0.4, rotationSpeed: 0.2 },
    },
    { name: 'Wobbly portal', values: { thickness: 0.08, glow: 0.3, distortion: 0.6, speed: 1.5 } },
    { name: 'Shockwave band', values: { radius: 0.8, thickness: 0.25, glow: 0.6 } },
    {
      name: 'Thin targeting',
      values: {
        radius: 0.5,
        thickness: 0.01,
        glow: 0.1,
        segments: 4,
        gap: 0.6,
        rotationSpeed: -0.3,
      },
    },
    { name: 'Fat donut', values: { radius: 0.5, thickness: 0.4, glow: 0 } },
  ],
  featuredPreset: 'Dashed rune ring',
};
