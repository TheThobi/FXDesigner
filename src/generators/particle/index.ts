/**
 * Particle utility sprites (stylized, not toon): grayscale intensity with luminance alpha,
 * ready to be tinted by a particle system or by the shared color ramp.
 */
import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import flameFrag from './flame-tongue.glsl?raw';
import rippleFrag from './ripple.glsl?raw';
import shardsFrag from './shards.glsl?raw';
import sparkFrag from './spark.glsl?raw';
import trailFrag from './trail.glsl?raw';
import smokeWispFrag from './smoke-wisp.glsl?raw';
import splashFrag from './splash.glsl?raw';
import leafFrag from './leaf.glsl?raw';
import magicOrbFrag from './magic-orb.glsl?raw';

const PARTICLE_POST = { alphaMode: 1 };

export const ripple: ShaderGenerator = {
  kind: 'shader',
  id: 'particle-ripple',
  name: 'Ripple',
  category: 'particle',
  description: 'Expanding rings for water impacts and shockwaves; loops in time.',
  animated: true,
  fragment: rippleFrag,
  params: [
    param.int('rings', 'Rings', 3, 1, 8),
    param.float('maxRadius', 'Max radius', 0.95, 0.2, 1),
    param.float('thickness', 'Thickness', 0.06, 0.005, 0.3),
    param.float('softness', 'Softness', 0.6, 0, 3),
    param.float('fade', 'Fade out', 1.5, 0, 6),
    param.float('distortion', 'Distortion', 0.3, 0, 2),
    param.speed(0.5, 2),
  ],
  defaultPost: PARTICLE_POST,
  presets: [
    {
      name: 'Raindrop',
      values: {
        rings: 2,
        maxRadius: 0.7,
        thickness: 0.03,
        softness: 0.3,
        fade: 2.5,
        distortion: 0.1,
      },
    },
    {
      name: 'Shockwave',
      values: {
        rings: 1,
        maxRadius: 1,
        thickness: 0.15,
        softness: 1.5,
        fade: 1,
        distortion: 0.8,
        speed: 1,
      },
    },
    {
      name: 'Sonar pulse',
      values: { rings: 6, thickness: 0.02, softness: 0.2, fade: 0.6, distortion: 0 },
    },
    {
      name: 'Wobbly splash',
      values: { rings: 4, thickness: 0.08, distortion: 1.6, softness: 0.8 },
    },
  ],
  featuredPreset: 'Wobbly splash',
};

export const flameTongue: ShaderGenerator = {
  kind: 'shader',
  id: 'particle-flame',
  name: 'Flame Tongue',
  category: 'particle',
  description: 'Single flame sprite for fire particles: bulb, tapered tip, turbulence.',
  animated: true,
  fragment: flameFrag,
  params: [
    param.float('width', 'Width', 1, 0.3, 2),
    param.float('height', 'Height', 1.1, 0.3, 1.4),
    param.float('sharpness', 'Tip sharpness', 1.3, 0.5, 4),
    param.float('turbulence', 'Turbulence', 0.6, 0, 2),
    param.float('softness', 'Edge softness', 0.5, 0, 1),
    param.speed(1, 4),
  ],
  defaultPost: PARTICLE_POST,
  presets: [
    {
      name: 'Candle',
      values: { width: 0.6, height: 0.9, sharpness: 1.8, turbulence: 0.2, softness: 0.6 },
    },
    {
      name: 'Wild tongue',
      values: { width: 1.2, height: 1.3, sharpness: 2.5, turbulence: 1.6, softness: 0.3, speed: 2 },
    },
    {
      name: 'Wisp',
      values: { width: 0.4, height: 1.4, sharpness: 3.5, turbulence: 1.2, softness: 0.9 },
    },
    {
      name: 'Bonfire blob',
      values: { width: 1.8, height: 1, sharpness: 0.8, turbulence: 0.9, softness: 0.4 },
    },
  ],
  featuredPreset: 'Wild tongue',
};

export const spark: ShaderGenerator = {
  kind: 'shader',
  id: 'particle-spark',
  name: 'Spark',
  category: 'particle',
  description: 'Tapered spark streak, or a radial burst of sparks (Count > 1).',
  animated: true,
  fragment: sparkFrag,
  params: [
    param.int('count', 'Count', 1, 1, 32),
    param.float('length', 'Length', 0.9, 0.05, 1.8),
    param.float('width', 'Width', 0.035, 0.005, 0.2),
    param.float('taper', 'Taper', 1.5, 0.2, 5),
    param.float('intensity', 'Intensity', 1.3, 0.2, 3),
    param.angle('angle', 'Angle (single)', 0),
    param.float('burstRadius', 'Burst gap', 0.15, 0, 0.6, { group: 'Burst' }),
    param.float('randomness', 'Randomness', 0.5, 0, 1, { group: 'Burst' }),
    param.float('spread', 'Angle jitter', 0.3, 0, 1, { group: 'Burst' }),
    param.speed(0, 3),
  ],
  defaultPost: PARTICLE_POST,
  presets: [
    { name: 'Single streak', values: { count: 1 } },
    { name: 'Hit sparks', values: { count: 12, length: 0.6, burstRadius: 0.2, randomness: 0.7 } },
    {
      name: 'Firework',
      values: {
        count: 28,
        length: 0.4,
        width: 0.02,
        burstRadius: 0.35,
        randomness: 0.4,
        spread: 0.1,
      },
    },
    {
      name: 'Welding',
      values: {
        count: 18,
        length: 1.2,
        width: 0.012,
        taper: 3,
        burstRadius: 0.05,
        randomness: 0.9,
        spread: 0.6,
      },
    },
    {
      name: 'Chunky hit',
      values: { count: 6, length: 0.7, width: 0.09, taper: 0.8, intensity: 2, burstRadius: 0.25 },
    },
  ],
  featuredPreset: 'Hit sparks',
};

export const shards: ShaderGenerator = {
  kind: 'shader',
  id: 'particle-shards',
  name: 'Impact Shards',
  category: 'particle',
  description: 'Radial triangular shards with a center flash, for hits and impacts.',
  animated: false,
  fragment: shardsFrag,
  params: [
    param.int('shards', 'Shards', 12, 3, 48),
    param.float('innerRadius', 'Inner gap', 0.2, 0, 0.6),
    param.float('outerRadius', 'Reach', 0.95, 0.3, 1),
    param.float('width', 'Width', 0.6, 0.05, 1),
    param.float('randomness', 'Randomness', 0.6, 0, 1),
    param.float('tipFade', 'Tip fade', 0.6, 0, 1),
    param.float('flash', 'Center flash', 0.5, 0, 1),
    param.angle('rotation', 'Rotation', 0),
  ],
  defaultPost: PARTICLE_POST,
  presets: [
    {
      name: 'Ice shatter',
      values: {
        shards: 20,
        innerRadius: 0.1,
        width: 0.35,
        randomness: 0.8,
        tipFade: 0.3,
        flash: 0.8,
      },
    },
    {
      name: 'Star impact',
      values: { shards: 8, innerRadius: 0.3, width: 0.8, randomness: 0.1, tipFade: 0.8 },
    },
    {
      name: 'Debris ring',
      values: {
        shards: 40,
        innerRadius: 0.5,
        outerRadius: 0.8,
        width: 0.2,
        randomness: 1,
        flash: 0,
      },
    },
  ],
  featuredPreset: 'Ice shatter',
};

export const trail: ShaderGenerator = {
  kind: 'shader',
  id: 'particle-trail',
  name: 'Trail',
  category: 'particle',
  description: 'Ribbon texture for trail renderers; seamless along X, scrolls with time.',
  animated: true,
  fragment: trailFrag,
  params: [
    param.float('width', 'Width', 0.6, 0.05, 1),
    param.float('core', 'Core', 0.25, 0, 1),
    param.float('falloff', 'Falloff', 1.5, 0.2, 6),
    param.float('breakup', 'Breakup', 0.7, 0, 2),
    param.float('noiseScale', 'Noise scale', 4, 1, 16),
    param.float('streaks', 'Streak density', 12, 1, 40),
    param.float('streakAmount', 'Streaks', 0.5, 0, 1),
    param.bool('fadeEnd', 'Fade end (not seamless)', false),
    param.speed(1, 4),
  ],
  defaultPost: PARTICLE_POST,
  presets: [
    {
      name: 'Comet tail',
      values: { width: 0.4, core: 0.5, falloff: 2.5, breakup: 0.4, streaks: 20, fadeEnd: true },
    },
    {
      name: 'Magic ribbon',
      values: { width: 0.8, core: 0.15, falloff: 1, breakup: 1.4, noiseScale: 8, streaks: 6 },
    },
    {
      name: 'Speed trail',
      values: {
        width: 0.25,
        core: 0.6,
        falloff: 4,
        breakup: 0.2,
        streaks: 36,
        streakAmount: 0.9,
        speed: 3,
      },
    },
  ],
  featuredPreset: 'Comet tail',
};

export const smokeWisp: ShaderGenerator = {
  kind: 'shader',
  id: 'particle-smoke-wisp',
  name: 'Smoke Wisp',
  category: 'particle',
  description: 'Thin curling smoke strand (incense, extinguished flame, magic trails).',
  animated: true,
  fragment: smokeWispFrag,
  params: [
    param.float('curl', 'Curl', 0.8, 0, 2),
    param.float('width', 'Width', 1, 0.2, 3),
    param.float('length', 'Length', 1, 0.3, 1),
    param.float('detail', 'Detail', 3, 1, 8),
    param.float('softness', 'Softness', 0.5, 0, 1),
    param.float('breakup', 'Breakup', 0.5, 0, 1),
    param.speed(0.6, 3),
  ],
  defaultPost: PARTICLE_POST,
  presets: [
    { name: 'Incense', values: { curl: 0.6, width: 0.7, breakup: 0.3, softness: 0.7 } },
    { name: 'Snuffed candle', values: { curl: 1.4, width: 1.2, breakup: 0.7, speed: 1 } },
    { name: 'Ghost ribbon', values: { curl: 1.8, width: 2.2, softness: 1, breakup: 0.2 } },
  ],
  featuredPreset: 'Snuffed candle',
};

export const splash: ShaderGenerator = {
  kind: 'shader',
  id: 'particle-splash',
  name: 'Splash',
  category: 'particle',
  description: 'Top-down liquid splash: crown ring and teardrop droplets flying outward.',
  animated: true,
  fragment: splashFrag,
  params: [
    param.int('drops', 'Droplets', 12, 3, 32),
    param.float('spread', 'Spread', 0.85, 0.2, 1),
    param.float('dropSize', 'Droplet size', 0.05, 0.01, 0.15),
    param.float('stretch', 'Stretch', 2, 0, 6),
    param.float('ringRadius', 'Ring radius', 0.5, 0.1, 1),
    param.float('ringWidth', 'Ring width', 0.06, 0.005, 0.3),
    param.float('progress', 'Progress (when frozen)', 0.45, 0, 1),
    param.speed(0.6, 3),
  ],
  defaultPost: PARTICLE_POST,
  presets: [
    { name: 'Water drop', values: { drops: 10, dropSize: 0.04, stretch: 3, ringWidth: 0.04 } },
    {
      name: 'Heavy splat',
      values: { drops: 20, spread: 0.7, dropSize: 0.08, stretch: 1, ringWidth: 0.15 },
    },
    { name: 'Frozen burst', values: { speed: 0, progress: 0.35, drops: 16, stretch: 4 } },
  ],
  featuredPreset: 'Frozen burst',
};

export const leaf: ShaderGenerator = {
  kind: 'shader',
  id: 'particle-leaf',
  name: 'Leaf',
  category: 'particle',
  description: 'Stylized leaf sprite with veins and serration; bends and flutters.',
  animated: true,
  fragment: leafFrag,
  params: [
    param.float('width', 'Width', 0.32, 0.08, 0.6),
    param.float('roundness', 'Roundness', 0.8, 0.3, 2),
    param.float('tipSharpness', 'Tip sharpness', 1.2, 0, 2.5),
    param.float('serration', 'Serration', 0, 0, 1, { group: 'Edge' }),
    param.int('serrationCount', 'Teeth', 12, 4, 40, { group: 'Edge' }),
    param.int('veins', 'Side veins', 7, 0, 16, { group: 'Veins' }),
    param.float('veinStrength', 'Vein strength', 0.6, 0, 1, { group: 'Veins' }),
    param.float('stemLength', 'Stem length', 0.12, 0, 0.3),
    param.float('bend', 'Bend', 0.2, -1, 1),
    param.angle('rotation', 'Rotation', 0),
    param.speed(0, 3),
  ],
  defaultPost: { alphaMode: 3 },
  presets: [
    {
      name: 'Willow',
      values: { width: 0.14, roundness: 1.2, tipSharpness: 2, veins: 10, bend: 0.4 },
    },
    { name: 'Round leaf', values: { width: 0.5, roundness: 0.5, tipSharpness: 0.4, veins: 5 } },
    { name: 'Serrated', values: { width: 0.36, serration: 0.7, serrationCount: 18, veins: 9 } },
    { name: 'Falling', values: { bend: -0.3, rotation: 35, speed: 1.2 } },
  ],
  featuredPreset: 'Serrated',
};

export const magicOrb: ShaderGenerator = {
  kind: 'shader',
  id: 'particle-magic-orb',
  name: 'Magic Orb',
  category: 'particle',
  description: 'Swirling energy sphere with a bright rim, halo and orbiting motes.',
  animated: true,
  fragment: magicOrbFrag,
  params: [
    param.float('radius', 'Radius', 0.42, 0.1, 0.8),
    param.float('swirl', 'Swirl', 1, 0, 3),
    param.float('glow', 'Halo', 0.6, 0, 2),
    param.int('motes', 'Motes', 8, 0, 24, { group: 'Motes' }),
    param.float('orbit', 'Orbit radius', 0.7, 0.2, 1, { group: 'Motes' }),
    param.float('moteSize', 'Mote size', 0.03, 0.005, 0.1, { group: 'Motes' }),
    param.speed(0.8, 4),
  ],
  defaultPost: PARTICLE_POST,
  presets: [
    { name: 'Wisp orb', values: { radius: 0.3, glow: 1.2, motes: 4, swirl: 2 } },
    {
      name: 'Planet core',
      values: { radius: 0.55, swirl: 0.5, glow: 0.3, motes: 16, moteSize: 0.015 },
    },
    { name: 'Unstable', values: { swirl: 3, glow: 1.6, motes: 20, speed: 2.5 } },
  ],
  featuredPreset: 'Wisp orb',
};

export const PARTICLES = [
  ripple,
  flameTongue,
  spark,
  shards,
  trail,
  smokeWisp,
  splash,
  leaf,
  magicOrb,
];
