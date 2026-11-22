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
    'Long thin translucent shards layered around mid gray, mostly along one direction (in the ' +
    'spirit of Substance Crystal 2): crystalline streaks for ice, quartz, stylized rock. Seamless.',
  animated: false,
  layout: 'tiled',
  fragment: crystalFrag,
  params: [
    param.float('scale', 'Scale', 3, 1, 16, { description: 'Cells of the largest shards.' }),
    param.int('density', 'Shards per cell', 4, 1, 6),
    param.float('length', 'Length', 1.9, 0.2, 1.9, { description: 'Shard length, in cells.' }),
    param.float('width', 'Width', 0.22, 0.02, 0.8, { description: 'Base width / length.' }),
    param.float('angle', 'Angle', 90, 0, 180, { unit: '°' }),
    param.float('spread', 'Angle spread', 22, 0, 90, {
      unit: '°',
      description: 'Random tilt around Angle (90 = any direction).',
    }),
    param.float('facet', 'Facet shading', 0.7, 0, 1),
    param.int('layers', 'Layers', 1, 1, 4, { description: 'Finer shards on top.' }),
    param.float('contrast', 'Contrast', 0.8, 0.2, 4),
  ],
  presets: [
    { name: 'Vertical shards', values: {} },
    {
      name: 'Fine needles',
      values: { scale: 6, density: 5, length: 1.8, width: 0.05, spread: 10 },
    },
    { name: 'Crossed slivers', values: { spread: 45, density: 4, width: 0.1, layers: 3 } },
    { name: 'Soft facets', values: { scale: 3, width: 0.3, facet: 0.4, contrast: 0.8 } },
    { name: 'Shattered', values: { scale: 5, spread: 90, length: 1, width: 0.25, layers: 3 } },
    { name: 'Horizontal streaks', values: { angle: 0, spread: 12, density: 4, width: 0.08 } },
  ],
  featuredPreset: 'Vertical shards',
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
