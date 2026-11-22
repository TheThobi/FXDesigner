/**
 * Material generators in the spirit of Substance Designer's (own implementations): weave,
 * creased sheets, crystal shards and anisotropic noise. All seamless height-style outputs.
 */
import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import weaveFrag from '../pattern/weave.glsl?raw';
import anisotropicFrag from './anisotropic.glsl?raw';
import creasedFrag from './creased.glsl?raw';
import crystalFrag from './crystal.glsl?raw';

export const weave: ShaderGenerator = {
  kind: 'shader',
  id: 'weave',
  name: 'Weave',
  category: 'material',
  description:
    'Woven threads crossing over and under (plain, twill, basket) as a height map: fabric, ' +
    'baskets, wicker. Seamless.',
  animated: false,
  layout: 'tiled',
  fragment: weaveFrag,
  params: [
    param.select('pattern', 'Pattern', ['Plain', 'Twill', 'Basket'], 0, {
      description: 'Over / under order of the threads.',
    }),
    param.int('threads', 'Threads', 12, 2, 64, {
      description: 'Threads per side (rounded to whole pattern repeats).',
    }),
    param.float('width', 'Thread width', 0.8, 0.2, 1),
    param.float('irregularity', 'Irregularity', 0.15, 0, 0.6, {
      description: 'Random width variation between threads.',
    }),
    param.float('fibers', 'Fibers', 0.5, 0, 1),
  ],
  presets: [
    { name: 'Linen', values: { pattern: 0, threads: 16, width: 0.85, fibers: 0.6 } },
    { name: 'Denim twill', values: { pattern: 1, threads: 24, width: 0.9, fibers: 0.7 } },
    { name: 'Basket', values: { pattern: 2, threads: 8, width: 0.7, fibers: 0.3 } },
    {
      name: 'Wicker',
      values: { pattern: 0, threads: 6, width: 0.65, irregularity: 0.3, fibers: 0.9 },
    },
  ],
  featuredPreset: 'Basket',
};

export const creased: ShaderGenerator = {
  kind: 'shader',
  id: 'creased',
  name: 'Creased',
  category: 'material',
  description:
    'Crumpled sheet as a height map: a network of short sharp creases (ridges and valleys) ' +
    'over several octaves, like crumpled paper or foil. Seamless.',
  animated: false,
  layout: 'tiled',
  fragment: creasedFrag,
  params: [
    param.float('scale', 'Scale', 3, 1, 16, { description: 'Cells of the largest creases.' }),
    param.int('density', 'Creases per cell', 3, 1, 4),
    param.float('length', 'Length', 1.2, 0.3, 2, { description: 'Crease length, in cells.' }),
    param.float('width', 'Width', 0.22, 0.03, 1.5, {
      description: 'How far a crease bends the sheet around it.',
    }),
    param.float('sharpness', 'Sharpness', 3, 0.3, 8, {
      description: 'Rounded folds (low) to knife-edge creases (high).',
    }),
    param.int('octaves', 'Octaves', 4, 1, 6),
    param.float('roughness', 'Roughness', 0.65, 0.2, 0.9, {
      description: 'Weight of each finer octave.',
    }),
    param.float('warp', 'Warp', 0.3, 0, 3, { description: 'Bends the crease lines.' }),
    param.float('contrast', 'Contrast', 1.5, 0.2, 4),
  ],
  presets: [
    { name: 'Crumpled paper', values: {} },
    { name: 'Foil', values: { scale: 4, density: 4, width: 0.12, sharpness: 5, octaves: 5 } },
    {
      name: 'Folded map',
      values: { scale: 2, density: 1, length: 2, width: 1.2, sharpness: 1, octaves: 1, warp: 0 },
    },
    {
      name: 'Wrinkled cloth',
      values: { scale: 3, density: 2, length: 1.6, width: 0.8, sharpness: 0.6, warp: 1.5 },
    },
    {
      name: 'Shattered crust',
      values: { scale: 5, density: 4, length: 0.8, width: 0.25, sharpness: 3, roughness: 0.7 },
    },
    {
      name: 'Soft dunes',
      values: { scale: 2, density: 2, length: 2, width: 1.5, sharpness: 0.4, octaves: 2 },
    },
  ],
  featuredPreset: 'Crumpled paper',
};

export const crystal: ShaderGenerator = {
  kind: 'shader',
  id: 'crystal',
  name: 'Crystal',
  category: 'material',
  description:
    'Crystalline shards (in the spirit of Substance Crystal 2): long prisms with a lit and a ' +
    'dark face, overlapping in layers. Seamless.',
  animated: false,
  layout: 'tiled',
  fragment: crystalFrag,
  params: [
    param.float('scale', 'Scale', 4, 1, 16, { description: 'Cells of the largest shards.' }),
    param.int('density', 'Shards per cell', 2, 1, 4),
    param.float('size', 'Size', 1.2, 0.2, 1.9, { description: 'Shard length, in cells.' }),
    param.float('thinness', 'Width', 0.22, 0.05, 1, { description: 'Width / length ratio.' }),
    param.float('angle', 'Angle', 60, 0, 180, { unit: '°' }),
    param.float('disorder', 'Disorder', 1, 0, 1, {
      description: 'Random directions (1) or all along Angle (0).',
    }),
    param.float('facet', 'Facet shading', 0.6, 0, 1, {
      description: 'Contrast between the two faces of a shard.',
    }),
    param.float('edge', 'Edge', 0.08, 0, 0.5, { description: 'Dark rim around each shard.' }),
    param.int('layers', 'Layers', 2, 1, 5, { description: 'Finer shards stacked on top.' }),
  ],
  presets: [
    { name: 'Quartz cluster', values: {} },
    {
      name: 'Aligned needles',
      values: { scale: 6, density: 3, size: 1.6, thinness: 0.08, disorder: 0.15, angle: 75 },
    },
    {
      name: 'Shattered ice',
      values: { scale: 3, density: 2, size: 1.4, thinness: 0.6, facet: 0.8, edge: 0.04 },
    },
    {
      name: 'Gem facets',
      values: { scale: 4, density: 4, size: 0.9, thinness: 0.9, facet: 1, edge: 0.15, layers: 1 },
    },
    {
      name: 'Crystal dust',
      values: { scale: 10, density: 3, size: 0.6, thinness: 0.3, layers: 3 },
    },
    {
      name: 'Amethyst spikes',
      values: {
        scale: 3,
        density: 3,
        size: 1.9,
        thinness: 0.18,
        disorder: 0.5,
        angle: 90,
        layers: 3,
      },
    },
  ],
  featuredPreset: 'Quartz cluster',
};

export const anisotropicNoise: ShaderGenerator = {
  kind: 'shader',
  id: 'anisotropic-noise',
  name: 'Anisotropic Noise',
  category: 'noise',
  description:
    'Value noise stretched into rows: wood grain, brushed streaks, rain, fabric. Seamless.',
  animated: false,
  layout: 'tiled',
  fragment: anisotropicFrag,
  params: [
    param.int('rows', 'Rows', 64, 2, 512),
    param.int('length', 'Cells per row', 2, 1, 32),
    param.float('smoothness', 'Smoothness', 1, 0, 1, {
      description: 'Blocky steps (0) to smooth ramps (1) along the rows.',
    }),
    param.float('rowBlend', 'Row blend', 0, 0, 1, {
      description: 'Hard (0) or soft (1) borders between rows.',
    }),
    param.int('detail', 'Detail', 2, 1, 5),
    param.float('contrast', 'Contrast', 1, 0.2, 4),
    param.bool('vertical', 'Vertical', false),
  ],
  presets: [
    { name: 'Streaks', values: { rows: 96, length: 2, detail: 2 } },
    {
      name: 'Wood grain',
      values: { rows: 48, length: 3, rowBlend: 0.8, detail: 3, contrast: 1.5 },
    },
    { name: 'Rain', values: { rows: 160, length: 6, smoothness: 0.4, vertical: true } },
    { name: 'Barcode', values: { rows: 32, length: 1, smoothness: 0, contrast: 2 } },
    { name: 'Fabric warp', values: { rows: 256, length: 12, smoothness: 0.2, detail: 2 } },
    { name: 'Soft stripes', values: { rows: 12, length: 1, rowBlend: 1, detail: 1 } },
    {
      name: 'Glitch bands',
      values: { rows: 24, length: 8, smoothness: 0, rowBlend: 0, detail: 3, contrast: 2.5 },
    },
  ],
  featuredPreset: 'Streaks',
};

export const MATERIAL_GENERATORS = [weave, creased, crystal, anisotropicNoise];
