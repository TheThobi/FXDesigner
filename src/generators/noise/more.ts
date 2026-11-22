/** Additional noise generators (oriented, flow, veins, waves, facets, splats). */
import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import facetsFrag from './facets.glsl?raw';
import flowStrokesFrag from './flow-strokes.glsl?raw';
import gaborFrag from './gabor.glsl?raw';
import ripplesFrag from './ripples.glsl?raw';
import splatterFrag from './splatter.glsl?raw';
import veinsFrag from './veins.glsl?raw';

export const gabor: ShaderGenerator = {
  kind: 'shader',
  id: 'gabor',
  name: 'Gabor Noise',
  category: 'noise',
  description: 'Oriented band-limited noise: fibers, brushed metal, fabric, hatching. Seamless.',
  animated: true,
  fragment: gaborFrag,
  params: [
    param.float('scale', 'Cells', 8, 1, 24),
    param.int('impulses', 'Impulses / cell', 10, 1, 16),
    param.float('frequency', 'Frequency', 4, 0.25, 8),
    param.float('bandwidth', 'Kernel tightness', 1.3, 1.1, 4),
    param.float('angle', 'Angle', 0, 0, 180),
    param.float('isotropy', 'Random orientation', 0, 0, 1),
    param.float('gain', 'Contrast', 1.6, 0.2, 4),
    param.speed(0, 4),
  ],
  presets: [
    { name: 'Brushed metal', values: { frequency: 4, bandwidth: 1.3, isotropy: 0, scale: 10 } },
    { name: 'Fabric weave', values: { frequency: 3, isotropy: 0.25, scale: 8 } },
    {
      name: 'Hatching',
      values: { frequency: 2.5, bandwidth: 2.2, isotropy: 0.08, angle: 45 },
    },
    { name: 'Isotropic', values: { isotropy: 1, frequency: 1.5 } },
    {
      name: 'Wood fibers',
      values: { scale: 6, impulses: 14, frequency: 6, bandwidth: 1.2, angle: 90, gain: 2.2 },
    },
    {
      name: 'Fingerprint',
      values: { scale: 4, impulses: 16, frequency: 2, bandwidth: 3, isotropy: 0.6, gain: 3 },
    },
  ],
  featuredPreset: 'Hatching',
};

export const flowStrokes: ShaderGenerator = {
  kind: 'shader',
  id: 'flow-strokes',
  name: 'Flow Strokes',
  category: 'noise',
  description:
    'Brush-like streaks following swirling currents (line integral convolution). Seamless.',
  animated: true,
  fragment: flowStrokesFrag,
  params: [
    param.float('flowScale', 'Flow scale', 2, 1, 8),
    param.float('density', 'Stroke density', 96, 4, 200),
    param.float('length', 'Stroke length', 0.06, 0.005, 0.3),
    param.int('steps', 'Quality (steps)', 12, 4, 32),
    param.float('contrast', 'Contrast', 2.5, 0.5, 6),
    param.speed(0, 1),
  ],

  presets: [
    {
      name: 'Swirling sky',
      values: { flowScale: 2, density: 60, length: 0.1 },
      ramp: GRADIENTS.lagoon,
    },
    { name: 'Wind streaks', values: { flowScale: 1, density: 90, length: 0.2 } },
    { name: 'Fur', values: { flowScale: 4, density: 180, length: 0.03, steps: 8, contrast: 3 } },
    {
      name: 'Long brush',
      values: { flowScale: 1, density: 40, length: 0.2, steps: 28, contrast: 2 },
    },
  ],
  featuredPreset: 'Swirling sky',
};

export const veins: ShaderGenerator = {
  kind: 'shader',
  id: 'veins',
  name: 'Veins',
  category: 'noise',
  description: 'Marble veins, wood rings and agate bands from turbulent sines.',
  animated: true,
  fragment: veinsFrag,
  params: [
    param.select('pattern', 'Pattern', [
      'Marble (seamless)',
      'Wood rings',
      'Agate bands (seamless)',
    ]),
    param.int('bands', 'Bands', 4, 1, 40),
    param.float('distortion', 'Distortion', 2.5, 0, 10),
    param.float('sharpness', 'Vein sharpness', 3, 1, 12),
    param.float('scale', 'Noise scale', 3, 1, 12),
    param.int('octaves', 'Octaves', 5, 1, 8),
    param.int('slant', 'Slant (marble)', 1, -3, 3),
    param.float('stretch', 'Stretch (wood)', 0.25, 0.05, 1),
    param.vec2('center', 'Center (wood)', [0, -1.2], -2, 2),
    param.speed(0, 1),
  ],
  presets: [
    { name: 'White marble', values: { pattern: 0, bands: 3, distortion: 3, sharpness: 4 } },
    {
      name: 'Wood grain',
      values: { pattern: 1, bands: 30, distortion: 3, sharpness: 2 },
      ramp: GRADIENTS.gold,
    },
    {
      name: 'Agate',
      values: { pattern: 2, bands: 10, sharpness: 2 },
      ramp: GRADIENTS.sunset,
    },
    { name: 'Tree rings tight', values: { pattern: 1, bands: 24, distortion: 1.2, sharpness: 6 } },
    {
      name: 'Storm marble',
      values: { pattern: 0, bands: 8, distortion: 6, sharpness: 8, octaves: 7 },
    },
  ],
  featuredPreset: 'Agate',
};

export const ripples: ShaderGenerator = {
  kind: 'shader',
  id: 'ripples',
  name: 'Ripples',
  category: 'water',
  description: 'Interference of circular waves. Seamless; loops at integer speeds.',
  animated: true,
  fragment: ripplesFrag,
  params: [
    param.int('sources', 'Sources', 6, 1, 16),
    param.float('frequency', 'Frequency', 10, 1, 60),
    param.float('variation', 'Frequency variation', 0.3, 0, 1),
    param.float('damping', 'Damping', 1, 0, 10),
    param.float('sharpness', 'Sharpness', 1, 0.3, 8),
    param.speed(0.5, 3),
  ],
  presets: [
    {
      name: 'Rain on pond',
      values: { sources: 14, frequency: 30, variation: 0.8, damping: 6, sharpness: 2 },
    },
    {
      name: 'Interference',
      values: { sources: 3, frequency: 18, variation: 0, damping: 0, sharpness: 1 },
    },
    { name: 'Sharp rings', values: { sources: 6, frequency: 12, damping: 2, sharpness: 6 } },
  ],
  featuredPreset: 'Rain on pond',
};

export const facets: ShaderGenerator = {
  kind: 'shader',
  id: 'facets',
  name: 'Facets',
  category: 'material',
  description: 'Shattered Voronoi planes: chiselled facets for rocks and crystals. Seamless.',
  animated: false,
  fragment: facetsFrag,
  params: [
    param.float('scale', 'Cells', 6, 1, 32),
    param.float('jitter', 'Jitter', 1, 0, 1),
    param.float('slope', 'Facet slope', 0.8, 0, 2),
    param.float('variation', 'Tone variation', 0.6, 0, 1),
    param.float('crackWidth', 'Crack width', 0.03, 0, 0.2),
    param.float('crackDarkness', 'Crack darkness', 0.8, 0, 1),
  ],
  presets: [
    {
      name: 'Cracked facets',
      values: { slope: 1.2, crackWidth: 0.02 },
      ramp: GRADIENTS.amethyst,
    },
    { name: 'Low-poly', values: { scale: 5, slope: 1.4, variation: 0.3, crackWidth: 0 } },
    {
      name: 'Broken tiles',
      values: { scale: 8, slope: 0.4, variation: 0.9, crackWidth: 0.08, crackDarkness: 1 },
    },
  ],
  featuredPreset: 'Cracked facets',
};

export const splatter: ShaderGenerator = {
  kind: 'shader',
  id: 'splatter',
  name: 'Splatter',
  category: 'noise',
  description: 'Paint splats with droplets and per-splat tone. Seamless.',
  animated: false,
  fragment: splatterFrag,
  params: [
    param.int('cells', 'Grid', 5, 1, 24),
    param.float('density', 'Density', 0.6, 0, 1),
    param.float('size', 'Size', 0.3, 0.05, 0.5),
    param.float('roughness', 'Edge roughness', 0.6, 0, 2),
    param.int('droplets', 'Droplets', 5, 0, 8),
    param.float('toneVariation', 'Tone variation', 0.5, 0, 1),
  ],
  defaultPost: { alphaMode: 1 },
  presets: [
    {
      name: 'Ink blots',
      values: { cells: 3, density: 0.8, size: 0.45, roughness: 1.2, droplets: 7 },
    },
    {
      name: 'Paint flecks',
      values: {
        cells: 12,
        density: 0.5,
        size: 0.15,
        roughness: 0.4,
        droplets: 3,
        toneVariation: 1,
      },
    },
    {
      name: 'Blood splats',
      values: { cells: 5, density: 0.6, size: 0.3, roughness: 2, droplets: 8, toneVariation: 0.2 },
    },
  ],
  featuredPreset: 'Ink blots',
};

export const MORE_NOISES = [gabor, flowStrokes, veins, ripples, facets, splatter];
