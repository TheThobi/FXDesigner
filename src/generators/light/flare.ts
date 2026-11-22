import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './flare.glsl?raw';

export const flare: ShaderGenerator = {
  kind: 'shader',
  id: 'flare',
  name: 'Star Flare',
  category: 'light',
  description: 'Sparkle / lens-flare star with configurable rays.',
  animated: true,
  fragment,
  params: [
    param.int('rays', 'Rays', 4, 2, 24),
    param.float('rayLength', 'Ray length', 0.95, 0.1, 1.5, { group: 'Rays' }),
    param.float('rayWidth', 'Ray width', 0.04, 0.002, 0.3, { group: 'Rays' }),
    param.float('randomness', 'Length randomness', 0, 0, 1, { group: 'Rays' }),
    param.bool('secondary', 'Secondary rays', true, { group: 'Rays' }),
    param.float('glow', 'Glow', 0.6, 0, 2, { group: 'Glow' }),
    param.float('glowSize', 'Glow size', 0.5, 0.05, 1.5, { group: 'Glow' }),
    param.float('core', 'Core size', 0.05, 0, 0.4, { group: 'Glow' }),
    param.float('rotation', 'Rotation', 0, 0, 360),
    param.speed(0, 2),
  ],
  defaultPost: { alphaMode: 1 },
  presets: [
    { name: 'Sparkle', values: { rays: 4, secondary: true, rayWidth: 0.04, glow: 0.6 } },
    {
      name: 'Sun star',
      values: { rays: 12, randomness: 0.7, rayWidth: 0.03, glow: 1, glowSize: 0.7 },
    },
    {
      name: 'Cross',
      values: { rays: 2, secondary: false, rayWidth: 0.02, glow: 0.3, rotation: 90 },
    },
    {
      name: 'Anamorphic streak',
      values: {
        rays: 2,
        rayLength: 1.5,
        rayWidth: 0.01,
        secondary: false,
        glow: 0.4,
        glowSize: 0.2,
        rotation: 0,
      },
    },
    {
      name: 'Spiky burst',
      values: { rays: 18, rayLength: 1.1, rayWidth: 0.08, randomness: 1, glow: 0.4, core: 0.12 },
    },
    {
      name: 'Soft orb',
      values: { rays: 6, rayLength: 0.4, rayWidth: 0.2, glow: 1.6, glowSize: 1, core: 0.2 },
    },
  ],
  featuredPreset: 'Sun star',
};
