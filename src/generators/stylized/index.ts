/**
 * Stylized (toon / anime / comic) effect generators. Most return flat tones meant to be mapped
 * through a color ramp; sprites with hard silhouettes return their mask in alpha.
 */
import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import comicBurstFrag from './comic-burst.glsl?raw';
import hexShieldFrag from './hex-shield.glsl?raw';
import slashFrag from './slash.glsl?raw';
import sparklesFrag from './sparkles.glsl?raw';
import speedLinesFrag from './speed-lines.glsl?raw';
import toonCloudFrag from './toon-cloud.glsl?raw';
import toonWaterFrag from './toon-water.glsl?raw';
import vortexFrag from './vortex.glsl?raw';
import smearFrag from './smear.glsl?raw';
import hookFlameFrag from './hook-flame.glsl?raw';
import bubblesFrag from './bubbles.glsl?raw';
import shockwaveFrag from './shockwave.glsl?raw';

const SOURCE_ALPHA = 3;
const LUMINANCE_ALPHA = 1;

export const slash: ShaderGenerator = {
  kind: 'shader',
  id: 'slash',
  name: 'Slash',
  category: 'impact',
  description: 'Anime sword-trail crescent with streaks and a hot edge.',
  animated: true,
  fragment: slashFrag,
  params: [
    param.float('radius', 'Radius', 0.8, 0.2, 1),
    param.float('thickness', 'Thickness', 0.55, 0.02, 0.9),
    param.float('arc', 'Arc length', 220, 20, 340),
    param.float('taper', 'Tail taper', 0.7, 0.1, 3),
    param.float('falloff', 'Inner falloff', 0.8, 0.2, 6),
    param.float('streaks', 'Streaks', 14, 0, 40, { group: 'Detail' }),
    param.float('streakAmount', 'Streak amount', 0.5, 0, 1, { group: 'Detail' }),
    param.float('edgeHighlight', 'Edge highlight', 1, 0, 1, { group: 'Detail' }),
    param.float('rotation', 'Rotation', 0, 0, 360),
    param.speed(1, 4),
  ],
  defaultPost: { alphaMode: LUMINANCE_ALPHA },
  presets: [
    { name: 'Clean slash', values: { streakAmount: 0.2, falloff: 2.5 } },
    {
      name: 'Clean slash',
      values: { streakAmount: 0.3 },
      ramp: GRADIENTS.saffron,
    },
    { name: 'Wide swing', values: { arc: 300, thickness: 0.5, taper: 1.5 } },
    {
      name: 'Crescent moon',
      values: { radius: 0.6, thickness: 0.75, arc: 160, taper: 2, streaks: 0, edgeHighlight: 1 },
    },
    {
      name: 'Whirlwind',
      values: { arc: 330, thickness: 0.3, taper: 0.4, streaks: 30, streakAmount: 0.8, speed: 2 },
    },
    {
      name: 'Thin cut',
      values: { radius: 0.9, thickness: 0.12, arc: 120, taper: 2.5, falloff: 3, streaks: 4 },
    },
  ],
  featuredPreset: 'Wide swing',
};

export const speedLines: ShaderGenerator = {
  kind: 'shader',
  id: 'speed-lines',
  name: 'Speed Lines',
  category: 'impact',
  description: 'Manga focus lines or scrolling speed streaks.',
  animated: true,
  fragment: speedLinesFrag,
  params: [
    param.select('mode', 'Mode', ['Radial focus', 'Parallel streaks']),
    param.int('count', 'Line count', 120, 4, 400),
    param.float('width', 'Width', 0.4, 0.02, 1),
    param.float('density', 'Density', 0.8, 0, 1),
    param.float('randomness', 'Randomness', 0.7, 0, 1),
    param.float('innerRadius', 'Clear radius', 0.5, 0, 1.4, { group: 'Radial' }),
    param.float('taperLength', 'Taper length', 0.5, 0.01, 1.5, { group: 'Radial' }),
    param.vec2('center', 'Center', [0, 0], -1, 1, { group: 'Radial' }),
    param.float('streakLength', 'Streak length', 0.4, 0.05, 1, { group: 'Parallel' }),
    param.float('rate', 'Re-rolls / s', 12, 0, 30, { group: 'Animation' }),
    param.speed(1, 4),
  ],
  defaultPost: { alphaMode: LUMINANCE_ALPHA },
  presets: [
    {
      name: 'Focus burst',
      values: { mode: 0, count: 200, width: 0.25, innerRadius: 0.7, density: 0.9 },
    },
    {
      name: 'Dash streaks',
      values: { mode: 1, count: 60, width: 0.3, streakLength: 0.6, rate: 20 },
    },
    {
      name: 'Soft tunnel',
      values: {
        mode: 0,
        count: 48,
        width: 0.8,
        innerRadius: 0.3,
        taperLength: 1.2,
        randomness: 0.3,
      },
    },
    {
      name: 'Manga impact',
      values: {
        mode: 0,
        count: 320,
        width: 0.15,
        density: 1,
        randomness: 1,
        innerRadius: 0.9,
        taperLength: 0.3,
      },
    },
    {
      name: 'Rain streaks',
      values: { mode: 1, count: 220, width: 0.08, streakLength: 0.25, randomness: 1, rate: 26 },
    },
    {
      name: 'Off-center rush',
      values: { mode: 0, count: 140, center: [0.5, -0.4], innerRadius: 0.4, taperLength: 0.9 },
    },
  ],
  featuredPreset: 'Focus burst',
};

export const comicBurst: ShaderGenerator = {
  kind: 'shader',
  id: 'comic-burst',
  name: 'Comic Burst',
  category: 'impact',
  description: '"KAPOW" impact star with ink outline; line-boil animation.',
  animated: true,
  fragment: comicBurstFrag,
  params: [
    param.int('spikes', 'Spikes', 10, 5, 40),
    param.float('inner', 'Inner radius', 0.75, 0.2, 0.95),
    param.float('randomness', 'Randomness', 0.6, 0, 1),
    param.float('size', 'Size', 0.95, 0.2, 1),
    param.bool('layers', 'Inner layer', true),
    param.float('innerScale', 'Inner layer scale', 0.6, 0.2, 0.9),
    param.float('outlineWidth', 'Outline width', 0.04, 0, 0.15),
    param.float('rotation', 'Rotation', 0, 0, 360),
    param.float('boil', 'Boil / s', 6, 0, 24, {
      group: 'Animation',
      description: 'Hand-drawn jitter frequency.',
    }),
  ],
  defaultPost: { alphaMode: SOURCE_ALPHA },
  presets: [
    {
      name: 'Soft bloom',
      values: { spikes: 7, inner: 0.85, randomness: 0.3, layers: true, outlineWidth: 0, boil: 3 },
    },
    {
      name: 'Jagged star',
      values: { spikes: 24, inner: 0.5, randomness: 0.9, outlineWidth: 0.06 },
    },
    {
      name: 'Badge',
      values: { spikes: 16, inner: 0.9, randomness: 0, layers: false, outlineWidth: 0.03, boil: 0 },
    },
    {
      name: 'Explosion cloud',
      values: {
        spikes: 12,
        inner: 0.7,
        randomness: 1,
        size: 1,
        layers: true,
        innerScale: 0.8,
        boil: 12,
      },
    },
    {
      name: 'Thin spikes',
      values: { spikes: 36, inner: 0.3, randomness: 0.4, outlineWidth: 0.02, layers: false },
    },
  ],
  featuredPreset: 'Soft bloom',
};

export const toonCloud: ShaderGenerator = {
  kind: 'shader',
  id: 'toon-cloud',
  name: 'Toon Cloud',
  category: 'fire',
  description: 'Cel-shaded cloud / smoke puff with outline. Alpha = silhouette.',
  animated: true,
  fragment: toonCloudFrag,
  params: [
    param.int('puffs', 'Puffs', 7, 3, 12),
    param.float('puffSize', 'Puff size', 0.35, 0.1, 0.6),
    param.float('spread', 'Spread', 0.5, 0.1, 0.8),
    param.float('squash', 'Vertical squash', 0.65, 0.3, 1.2),
    param.float('blend', 'Blend', 0.06, 0, 0.3),
    param.bool('flatBottom', 'Flat bottom', true),
    param.float('lightAngle', 'Light angle', 125, 0, 360, { group: 'Shading' }),
    param.float('shadowOffset', 'Shadow size', 0.12, 0, 0.4, { group: 'Shading' }),
    param.float('highlightOffset', 'Highlight size', 0.05, 0, 0.3, { group: 'Shading' }),
    param.float('outlineWidth', 'Outline width', 0.02, 0, 0.08, { group: 'Shading' }),
    param.float('wobble', 'Wobble', 0.5, 0, 2, { group: 'Animation' }),
    param.float('boil', 'Boil / s', 4, 0, 24, { group: 'Animation' }),
  ],
  defaultPost: { alphaMode: SOURCE_ALPHA },
  presets: [
    { name: 'Fluffy cloud', values: { puffs: 8, flatBottom: true, squash: 0.6 } },
    {
      name: 'Smoke puff',
      values: { puffs: 6, flatBottom: false, squash: 1 },
      ramp: GRADIENTS.linear,
    },
    { name: 'Dust cloud', values: { puffs: 10, flatBottom: true, squash: 0.45, spread: 0.7 } },
    {
      name: 'Storm cloud',
      values: {
        puffs: 11,
        puffSize: 0.45,
        spread: 0.75,
        squash: 0.5,
        shadowOffset: 0.25,
        outlineWidth: 0.03,
      },
    },
    {
      name: 'Tiny puff',
      values: { puffs: 4, puffSize: 0.25, spread: 0.25, squash: 0.9, flatBottom: false, boil: 10 },
    },
    {
      name: 'Flat-shaded',
      values: { puffs: 7, blend: 0.2, shadowOffset: 0.05, highlightOffset: 0, outlineWidth: 0 },
    },
  ],
  featuredPreset: 'Fluffy cloud',
};

export const hexShield: ShaderGenerator = {
  kind: 'shader',
  id: 'hex-shield',
  name: 'Hex Shield',
  category: 'light',
  description: 'Sci-fi energy shield: hex grid, fresnel rim, pulsing cells, impact wave.',
  animated: true,
  fragment: hexShieldFrag,
  params: [
    param.float('scale', 'Hex scale', 8, 2, 30),
    param.float('lineWidth', 'Line width', 0.05, 0.005, 0.3),
    param.bool('dome', 'Dome sprite', true),
    param.float('fresnelPower', 'Fresnel power', 2.5, 0.5, 8),
    param.float('rim', 'Rim glow', 0.6, 0, 2),
    param.float('cellGlow', 'Cell pulse', 0.6, 0, 2, { group: 'Animation' }),
    param.float('pulseSpeed', 'Pulse speed', 2, 0, 10, { group: 'Animation' }),
    param.float('wave', 'Wave', 0.8, 0, 2, { group: 'Animation' }),
    param.float('waveSpeed', 'Wave speed', 0.5, 0, 2, { group: 'Animation' }),
    param.float('scroll', 'Scroll', 0, -2, 2, { group: 'Animation' }),
  ],
  defaultPost: { alphaMode: LUMINANCE_ALPHA },
  presets: [
    {
      name: 'Force field',
      values: { scale: 10, lineWidth: 0.04, dome: true, fresnelPower: 3, rim: 1, cellGlow: 0.4 },
    },
    {
      name: 'Honeycomb panel',
      values: { scale: 6, lineWidth: 0.12, dome: false, cellGlow: 1, wave: 0.3 },
    },
    {
      name: 'Scanning grid',
      values: { scale: 20, lineWidth: 0.02, dome: false, wave: 1.6, waveSpeed: 1.2, scroll: 0.5 },
    },
    {
      name: 'Bubble barrier',
      values: {
        scale: 16,
        lineWidth: 0.02,
        dome: true,
        fresnelPower: 5,
        rim: 1.6,
        cellGlow: 0.2,
        wave: 0.4,
      },
    },
    {
      name: 'Pulsing hive',
      values: { scale: 5, lineWidth: 0.2, dome: false, cellGlow: 1.8, pulseSpeed: 6, wave: 0 },
    },
  ],
  featuredPreset: 'Force field',
};

export const vortex: ShaderGenerator = {
  kind: 'shader',
  id: 'vortex',
  name: 'Vortex',
  category: 'light',
  description: 'Portal / whirlpool spiral with noisy arms.',
  animated: true,
  fragment: vortexFrag,
  params: [
    param.int('arms', 'Arms', 3, 1, 12),
    param.float('twist', 'Twist', 3, -10, 10),
    param.float('sharpness', 'Sharpness', 1.5, 0.3, 6),
    param.float('noise', 'Noise', 0.5, 0, 1),
    param.float('noiseScale', 'Noise scale', 4, 0.5, 12),
    param.float('hole', 'Hole radius', 0.15, 0, 0.6),
    param.float('holeSoftness', 'Hole softness', 0.15, 0.01, 0.5),
    param.float('radius', 'Outer radius', 0.95, 0.3, 1.2),
    param.float('rimGlow', 'Rim glow', 0.6, 0, 2),
    param.speed(1, 6),
  ],
  defaultPost: { alphaMode: LUMINANCE_ALPHA },
  presets: [
    {
      name: 'Smooth portal',
      values: { noise: 0.2, sharpness: 1 },
      ramp: GRADIENTS.amethyst,
    },
    {
      name: 'Whirlpool',
      values: { arms: 5, twist: 5, hole: 0.05 },
      ramp: GRADIENTS.azure,
    },
    {
      name: 'Galaxy',
      values: { arms: 2, twist: 5, sharpness: 2.5, noise: 0.7, hole: 0.05, rimGlow: 0 },
    },
    {
      name: 'Drain',
      values: { arms: 6, twist: -4, sharpness: 1, hole: 0.3, holeSoftness: 0.05, rimGlow: 1 },
    },
    {
      name: 'Storm eye',
      values: { arms: 4, twist: 2, noise: 1, noiseScale: 8, hole: 0.2, speed: 0.4 },
    },
  ],
  featuredPreset: 'Smooth portal',
};

export const toonWater: ShaderGenerator = {
  kind: 'shader',
  id: 'toon-water',
  name: 'Toon Water',
  category: 'water',
  description: 'Stylized water with crisp foam lines (Wind-Waker-like look). Seamless.',
  animated: true,
  fragment: toonWaterFrag,
  params: [
    param.float('scale', 'Scale', 4, 1, 16),
    param.float('lineWidth', 'Foam width', 0.08, 0.01, 0.4),
    param.float('distortion', 'Distortion', 0.4, 0, 2),
    param.float('secondLayer', 'Second layer', 0.6, 0, 1),
    param.float('shading', 'Cell shading', 1, 0, 2),
    param.speed(0.3, 2),
  ],
  presets: [
    {
      name: 'Calm pond',
      values: { scale: 3, lineWidth: 0.05, distortion: 0.2, secondLayer: 0.3, speed: 0.15 },
    },
    {
      name: 'Rapids',
      values: { scale: 6, lineWidth: 0.12, distortion: 1.2, secondLayer: 0.9, speed: 0.8 },
    },
    {
      name: 'Deep sea',
      values: { scale: 2, lineWidth: 0.03, distortion: 0.6, secondLayer: 1, shading: 1.8 },
    },
  ],
  featuredPreset: 'Rapids',
};

export const sparkles: ShaderGenerator = {
  kind: 'shader',
  id: 'sparkles',
  name: 'Sparkles',
  category: 'light',
  description: 'Field of twinkling 4-point stars. Seamless; loops at integer speeds.',
  animated: true,
  fragment: sparklesFrag,
  params: [
    param.int('cells', 'Grid', 6, 1, 32),
    param.float('density', 'Density', 0.5, 0, 1),
    param.float('size', 'Size', 0.8, 0.02, 1.5),
    param.float('sizeVariation', 'Size variation', 0.6, 0, 1),
    param.float('glow', 'Glow', 0.6, 0, 2),
    param.float('rotation', 'Rotation', 0, 0, 90),
    param.float('randomRotation', 'Random rotation', 0, 0, 1),
    param.float('twinkle', 'Twinkle', 0.6, 0, 1, { group: 'Animation' }),
    param.speed(1, 4),
  ],
  defaultPost: { alphaMode: LUMINANCE_ALPHA },
  presets: [
    {
      name: 'Stardust',
      values: { cells: 16, density: 0.7, size: 0.4, sizeVariation: 0.9, glow: 1, twinkle: 0.9 },
    },
    {
      name: 'Big twinkles',
      values: { cells: 3, density: 0.8, size: 1.2, glow: 0.8, randomRotation: 0.5 },
    },
    {
      name: 'Snow glitter',
      values: { cells: 24, density: 0.5, size: 0.2, glow: 0.3, randomRotation: 1, twinkle: 0.4 },
    },
    {
      name: 'Rotating gems',
      values: { cells: 5, density: 0.6, size: 0.9, randomRotation: 1, glow: 0.4, twinkle: 0.3 },
    },
    {
      name: 'Dense shimmer',
      values: {
        cells: 32,
        density: 1,
        size: 0.15,
        sizeVariation: 1,
        glow: 1.5,
        twinkle: 1,
        speed: 2,
      },
    },
  ],
  featuredPreset: 'Stardust',
};

export const smear: ShaderGenerator = {
  kind: 'shader',
  id: 'smear',
  name: 'Smear Frame',
  category: 'impact',
  description: 'Dry-brush smear arc as in animation smear frames: solid head, bristle tail.',
  animated: true,
  fragment: smearFrag,
  params: [
    param.float('radius', 'Radius', 0.6, 0.2, 0.95),
    param.float('thickness', 'Thickness', 0.5, 0.05, 0.9),
    param.float('arc', 'Arc length', 200, 30, 340),
    param.float('taper', 'Tail taper', 0.8, 0.1, 3),
    param.int('lines', 'Bristles', 9, 2, 32),
    param.float('breakup', 'Breakup', 0.7, 0, 1),
    param.angle('rotation', 'Rotation', 0),
    param.speed(0.5, 4),
  ],
  defaultPost: { alphaMode: SOURCE_ALPHA },
  presets: [
    { name: 'Brush swipe', values: { thickness: 0.6, lines: 7, breakup: 0.8 } },
    { name: 'Fine bristles', values: { lines: 24, breakup: 0.9, taper: 1.5 } },
    { name: 'Heavy smear', values: { thickness: 0.85, arc: 140, lines: 5, breakup: 0.4 } },
    {
      name: 'Full spin',
      values: { arc: 340, thickness: 0.35, lines: 12, breakup: 0.6, speed: 1.5 },
    },
    {
      name: 'Quick flick',
      values: { radius: 0.8, thickness: 0.3, arc: 70, taper: 2.5, lines: 4, breakup: 0.3 },
    },
  ],
  featuredPreset: 'Brush swipe',
};

export const hookFlame: ShaderGenerator = {
  kind: 'shader',
  id: 'hook-flame',
  name: 'Hook Flames',
  category: 'fire',
  description: 'Anime fire with curling hooked tongues, outline band and bright core (3 tones).',
  animated: true,
  fragment: hookFlameFrag,
  params: [
    param.float('width', 'Width', 0.55, 0.15, 1),
    param.float('height', 'Height', 0.9, 0.3, 1.1),
    param.int('tongues', 'Tongues', 5, 1, 12),
    param.float('hook', 'Hook curl', 0.7, 0, 2),
    param.float('core', 'Core threshold', 0.55, 0.1, 0.9),
    param.float('outline', 'Outline band', 0.08, 0, 0.3),
    param.float('offset', 'Vertical offset', 0, -0.5, 0.5, {
      description: 'Moves the flame up (positive) or down; it never touches the image edges.',
    }),
    param.speed(1, 4),
  ],
  defaultPost: { alphaMode: SOURCE_ALPHA },
  presets: [
    { name: 'Campfire', values: { width: 0.6, tongues: 5, hook: 0.6 } },
    { name: 'Tall blaze', values: { width: 0.35, height: 1.1, tongues: 3, hook: 1.2 } },
    { name: 'Wild hooks', values: { tongues: 8, hook: 1.8, core: 0.4, speed: 1.6 } },
    {
      name: 'Candle',
      values: { width: 0.2, height: 0.7, tongues: 1, hook: 0.3, core: 0.7, outline: 0.05 },
    },
    {
      name: 'Wall of fire',
      values: { width: 1, height: 0.8, tongues: 12, hook: 0.9, core: 0.45, speed: 1.3 },
    },
    {
      name: 'Leaning blaze',
      values: { width: 0.5, tongues: 4, hook: 1.4, offset: 0.35, outline: 0.15 },
    },
  ],
  featuredPreset: 'Wild hooks',
};

export const bubbles: ShaderGenerator = {
  kind: 'shader',
  id: 'bubbles',
  name: 'Bubbles',
  category: 'water',
  description: 'Seamless field of rising bubbles with rims and crescent highlights.',
  animated: true,
  fragment: bubblesFrag,
  params: [
    param.int('cells', 'Cells', 5, 1, 16),
    param.float('density', 'Density', 0.6, 0, 1),
    param.float('size', 'Size', 0.7, 0.1, 1),
    param.float('sizeVariation', 'Size variation', 0.6, 0, 1),
    param.float('rim', 'Rim width', 0.15, 0.02, 0.6),
    param.float('highlight', 'Highlight', 0.8, 0, 1),
    param.speed(0.3, 2),
  ],
  defaultPost: { alphaMode: SOURCE_ALPHA },
  presets: [
    { name: 'Fizz', values: { cells: 10, size: 0.4, density: 0.8, rim: 0.25 } },
    { name: 'Big soap', values: { cells: 3, size: 0.9, rim: 0.08, highlight: 1 } },
    { name: 'Underwater', values: { cells: 6, density: 0.45, rim: 0.3, speed: 0.6 } },
  ],
  featuredPreset: 'Big soap',
};

export const shockwave: ShaderGenerator = {
  kind: 'shader',
  id: 'shockwave',
  name: 'Shockwave',
  category: 'impact',
  description: 'Expanding ring with a sharp front and debris chunks thrown outward.',
  animated: true,
  fragment: shockwaveFrag,
  params: [
    param.float('ringWidth', 'Ring width', 0.12, 0.02, 0.4),
    param.float('distortion', 'Front distortion', 0.5, 0, 2),
    param.int('debris', 'Debris', 16, 0, 48),
    param.float('debrisSize', 'Debris size', 0.03, 0.005, 0.08),
    param.float('progress', 'Progress (when frozen)', 0.4, 0, 1),
    param.speed(0.5, 3),
  ],
  defaultPost: { alphaMode: LUMINANCE_ALPHA },
  presets: [
    { name: 'Ground slam', values: { ringWidth: 0.2, debris: 28, debrisSize: 0.04 } },
    { name: 'Clean blast', values: { ringWidth: 0.08, distortion: 0, debris: 0 } },
    { name: 'Frozen impact', values: { speed: 0, progress: 0.3, debris: 24, distortion: 1.2 } },
  ],
  featuredPreset: 'Frozen impact',
};

export const STYLIZED_GENERATORS = [
  slash,
  speedLines,
  comicBurst,
  toonCloud,
  hexShield,
  vortex,
  toonWater,
  sparkles,
  smear,
  hookFlame,
  bubbles,
  shockwave,
];
