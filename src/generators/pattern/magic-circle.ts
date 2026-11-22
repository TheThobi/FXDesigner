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
    param.float('scale', 'Scale', 1, 0.2, 1.15, { group: 'Layout', limit: [0.05, 4] }),
    param.float('rotation', 'Rotation', 0, -180, 180, { group: 'Layout' }),
    param.toggle('outerBand', 'Outer band', true),
    param.float('outerRadius', 'Outer radius', 0.92, 0.35, 0.98, {
      group: 'Outer band',
      limit: [0.05, 1],
    }),
    param.float('bandWidth', 'Band width', 0.12, 0.02, 0.35, {
      group: 'Outer band',
      limit: [0.001, 0.8],
    }),
    param.toggle('starOn', 'Star', true),
    param.float('starRadius', 'Star radius', 0.8, 0.1, 0.95, { group: 'Star', limit: [0.01, 1] }),
    param.bool('outlineOn', 'Polygon outline', true, { group: 'Star' }),
    param.toggle('innerOn', 'Inner rings', true),
    param.float('innerGap', 'Ring gap', 0.18, 0.03, 0.75, {
      group: 'Inner rings',
      limit: [0, 0.95],
    }),
    param.toggle('dotsOn', 'Orbiting dots', true),
    param.int('dotCount', 'Dot count', 0, 0, 32, {
      group: 'Orbiting dots',
      description: '0 follows the number of star points.',
    }),
    param.float('dotSize', 'Dot size', 0.05, 0.01, 0.2, { group: 'Orbiting dots', limit: [0, 1] }),
    param.float('orbitSpeed', 'Orbit speed multiplier', 1.5, -4, 4, { group: 'Orbiting dots' }),
    param.int('spokes', 'Spokes', 0, 0, 32, { group: 'Center' }),
    param.float('centerRadius', 'Center radius', 0.16, 0.03, 0.4, {
      group: 'Center',
      visibleWhen: (v) => Number(v.spokes) > 0,
    }),
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
    {
      name: 'Astral compass',
      values: { sides: 8, ticks: 48, dotCount: 16, spokes: 8, orbitSpeed: -0.5 },
    },
  ],
  featuredPreset: 'Summoning',
};
