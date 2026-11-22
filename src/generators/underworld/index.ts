/**
 * "Underworld" effects: the bold, hand-drawn, high-contrast VFX language of mythic action
 * games (flat stacked tones, glowing fissures, radiant boons). Grayscale tones for the ramp.
 */
import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import divineAuraFrag from './divine-aura.glsl?raw';
import emberMotesFrag from './ember-motes.glsl?raw';
import impactCrackFrag from './impact-crack.glsl?raw';
import lavaCracksFrag from './lava-cracks.glsl?raw';
import soulFlameFrag from './soul-flame.glsl?raw';

export const soulFlame: ShaderGenerator = {
  kind: 'shader',
  id: 'soul-flame',
  name: 'Soul Flame',
  category: 'fire',
  description: 'Tall wavy flame in flat stacked tones with detached wisps (ghostly fire).',
  animated: true,
  fragment: soulFlameFrag,
  params: [
    param.float('width', 'Width', 0.4, 0.1, 0.8),
    param.float('height', 'Height', 0.85, 0.3, 1),
    param.float('waviness', 'Waviness', 1, 0, 2.5),
    param.int('bands', 'Tones', 3, 2, 6),
    param.int('wisps', 'Tip breakup', 3, 0, 6),
    param.speed(1, 4),
  ],
  defaultPost: { alphaMode: 3 },
  presets: [
    { name: 'Spirit candle', values: { width: 0.25, height: 0.7, waviness: 0.6, wisps: 2 } },
    {
      name: 'Hellfire',
      values: { width: 0.6, height: 1, waviness: 1.6, bands: 4, wisps: 5, speed: 1.4 },
    },
    { name: 'Calm soul', values: { waviness: 0.4, bands: 2, wisps: 1, speed: 0.5 } },
  ],
  featuredPreset: 'Hellfire',
};

export const lavaCracks: ShaderGenerator = {
  kind: 'shader',
  id: 'lava-cracks',
  name: 'Lava Cracks',
  category: 'material',
  description: 'Seamless dark rock plates split by glowing fissures with travelling heat pulses.',
  animated: true,
  fragment: lavaCracksFrag,
  params: [
    param.float('scale', 'Plates', 5, 1, 16, { step: 1 }),
    param.float('crackWidth', 'Crack width', 0.08, 0.01, 0.3),
    param.float('glow', 'Glow', 0.5, 0, 1.5),
    param.float('jagged', 'Jaggedness', 0.6, 0, 2),
    param.float('heatVariation', 'Heat variation', 0.5, 0, 1),
    param.float('rockDetail', 'Rock detail', 1, 0, 2),
    param.speed(0.5, 3),
  ],
  presets: [
    { name: 'Magma floor', values: { scale: 4, crackWidth: 0.12, glow: 0.8, jagged: 0.8 } },
    { name: 'Hairline cracks', values: { scale: 8, crackWidth: 0.03, glow: 0.3, jagged: 1.4 } },
    { name: 'Cooling crust', values: { scale: 3, crackWidth: 0.06, glow: 0.2, heatVariation: 1 } },
  ],
  featuredPreset: 'Magma floor',
};

export const divineAura: ShaderGenerator = {
  kind: 'shader',
  id: 'divine-aura',
  name: 'Divine Aura',
  category: 'light',
  description: 'Radiant blessing burst: swirling petal flames, glowing core and rising sparkles.',
  animated: true,
  fragment: divineAuraFrag,
  params: [
    param.int('petals', 'Petals', 7, 2, 16),
    param.float('radius', 'Radius', 0.75, 0.2, 1),
    param.float('twist', 'Twist', 2, -8, 8),
    param.float('softness', 'Softness', 0.4, 0, 1),
    param.int('sparkles', 'Sparkles', 12, 0, 24),
    param.speed(0.8, 3),
  ],
  defaultPost: { alphaMode: 1 },
  presets: [
    { name: 'Boon burst', values: { petals: 8, twist: 3, softness: 0.3, sparkles: 16 } },
    { name: 'Halo bloom', values: { petals: 12, twist: 0, softness: 0.8, sparkles: 6 } },
    { name: 'Vortex blessing', values: { petals: 4, twist: 7, radius: 0.9, sparkles: 20 } },
  ],
  featuredPreset: 'Boon burst',
};

export const impactCrack: ShaderGenerator = {
  kind: 'shader',
  id: 'impact-crack',
  name: 'Impact Crack',
  category: 'impact',
  description: 'Ground impact decal: branching radial cracks, scorch ring, hot center. Seeded.',
  animated: false,
  fragment: impactCrackFrag,
  params: [
    param.int('cracks', 'Cracks', 7, 2, 16),
    param.float('length', 'Length', 0.85, 0.2, 1),
    param.float('jaggedness', 'Jaggedness', 0.6, 0, 2),
    param.float('branches', 'Branching', 0.5, 0, 1),
    param.float('scorch', 'Scorch', 0.5, 0, 1),
    param.float('glow', 'Glow', 0.5, 0, 1.5),
  ],
  defaultPost: { alphaMode: 3 },
  presets: [
    { name: 'Ground slam', values: { cracks: 9, length: 0.95, branches: 0.8, scorch: 0.7 } },
    { name: 'Clean star', values: { cracks: 5, jaggedness: 0.2, branches: 0, scorch: 0.2 } },
    { name: 'Molten crater', values: { cracks: 12, glow: 1.3, scorch: 0.9, length: 0.7 } },
  ],
  featuredPreset: 'Molten crater',
};

export const emberMotes: ShaderGenerator = {
  kind: 'shader',
  id: 'ember-motes',
  name: 'Ember Motes',
  category: 'fire',
  description: 'Seamless field of rising, flickering embers (ambient particles).',
  animated: true,
  fragment: emberMotesFrag,
  params: [
    param.int('cells', 'Cells', 6, 1, 24),
    param.float('density', 'Density', 0.5, 0, 1),
    param.float('size', 'Size', 0.5, 0.1, 1.5),
    param.float('stretch', 'Stretch', 1.5, 0, 6),
    param.float('drift', 'Sway', 0.6, 0, 2),
    param.float('flicker', 'Flicker', 0.5, 0, 1),
    param.speed(0.6, 3),
  ],
  defaultPost: { alphaMode: 1 },
  presets: [
    { name: 'Hell embers', values: { cells: 8, density: 0.6, stretch: 2.5, flicker: 0.7 } },
    {
      name: 'Floating ash',
      values: { cells: 12, size: 0.3, stretch: 0, drift: 1.4, flicker: 0.1, speed: 0.2 },
    },
    { name: 'Spark storm', values: { cells: 4, density: 0.9, stretch: 5, speed: 2 } },
  ],
  featuredPreset: 'Hell embers',
};

export const UNDERWORLD_GENERATORS = [soulFlame, lavaCracks, divineAura, impactCrack, emberMotes];
