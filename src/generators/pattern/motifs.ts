import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import geoPatternFrag from './geo-pattern.glsl?raw';
import imageFrag from './image.glsl?raw';
import hatchingFrag from './hatching.glsl?raw';
import softMasksFrag from './soft-masks.glsl?raw';
import spotsFrag from './spots.glsl?raw';
import brushedMetalFrag from './brushed-metal.glsl?raw';
import crackedGlassFrag from './cracked-glass.glsl?raw';
import scratchesFrag from './scratches.glsl?raw';

export const geoPattern: ShaderGenerator = {
  kind: 'shader',
  id: 'geo-pattern',
  name: 'Geometric Pattern',
  category: 'pattern',
  description:
    'Classic seamless tile motifs: chevrons, seigaiha scales, triangles, shape grids, halftone ' +
    'dots, labyrinth, basket weave, concentric squares.',
  animated: true,
  fragment: geoPatternFrag,
  params: [
    param.select(
      'mode',
      'Motif',
      [
        'Chevrons',
        'Seigaiha scales',
        'Half-square triangles',
        'Shape grid',
        'Halftone dots',
        'Labyrinth',
        'Basket weave',
        'Concentric squares',
      ],
      0,
    ),
    param.int('cells', 'Cells', 8, 1, 48),
    param.float('thickness', 'Thickness', 0.5, 0.02, 0.98),
    param.float('amplitude', 'Zigzag / gradient', 1, 0, 3, {
      description: 'Chevron height, or halftone gradient curve.',
    }),
    param.int('rings', 'Rings', 4, 1, 12, { description: 'Seigaiha arcs / concentric squares.' }),
    param.select(
      'shape',
      'Shape',
      ['Circle', 'Triangle', 'Star', 'Rounded square', 'Diamond', 'Cross'],
      0,
      {
        group: 'Shapes',
      },
    ),
    param.float('size', 'Size', 0.7, 0.1, 1, { group: 'Shapes' }),
    param.bool('offsetRows', 'Offset rows', true, {
      group: 'Shapes',
      description: 'Brick layout (use an even cell count to stay seamless).',
    }),
    param.bool('outline', 'Outline only', false, { group: 'Shapes' }),
    param.float('randomness', 'Randomness', 0, 0, 1, {
      group: 'Shapes',
      description: 'Size variation (shapes) or random orientation (triangles).',
    }),
    param.angle('rotation', 'Rotation', 0, { group: 'Shapes' }),
    param.speed(0, 2),
  ],
  presets: [
    { name: 'Zigzag stripes', values: { mode: 0, cells: 8, thickness: 0.5, amplitude: 1 } },
    { name: 'Fine herringbone', values: { mode: 0, cells: 20, thickness: 0.35, amplitude: 2 } },
    { name: 'Wave scales', values: { mode: 1, cells: 6, rings: 4, thickness: 0.45 } },
    { name: 'Triangle mosaic', values: { mode: 2, cells: 6, randomness: 1 } },
    { name: 'Diamond tiles', values: { mode: 2, cells: 6, randomness: 0 } },
    { name: 'Star field', values: { mode: 3, shape: 2, cells: 6, size: 0.6 } },
    {
      name: 'Rounded tiles',
      values: { mode: 3, shape: 3, cells: 6, offsetRows: false, size: 0.8 },
    },
    { name: 'Polka triangles', values: { mode: 3, shape: 1, cells: 8, size: 0.5 } },
    {
      name: 'Halftone fade',
      values: { mode: 4, cells: 24, size: 1, amplitude: 1, offsetRows: true },
    },
    { name: 'Maze', values: { mode: 5, cells: 16, thickness: 0.35 } },
    { name: 'Woven fiber', values: { mode: 6, cells: 12 } },
    { name: 'Square rings', values: { mode: 7, cells: 2, rings: 6, thickness: 0.45 } },
  ],
  featuredPreset: 'Wave scales',
};

export const softMasks: ShaderGenerator = {
  kind: 'shader',
  id: 'soft-masks',
  name: 'Soft Masks',
  category: 'pattern',
  description:
    'Smooth grayscale masks for shaders: radial / diamond grids, sine stripes, swirl, ring ' +
    'cells and a streaked vertical glow.',
  animated: true,
  fragment: softMasksFrag,
  params: [
    param.select(
      'mode',
      'Mask',
      ['Radial grid', 'Diamond grid', 'Sine stripes', 'Swirl', 'Ring cells', 'Vertical glow'],
      0,
    ),
    param.int('cells', 'Cells', 2, 1, 32),
    param.bool('offsetRows', 'Offset rows', false),
    param.float('sharpness', 'Sharpness', 1, 0.2, 6, { description: 'Power curve of the mask.' }),
    param.select(
      'direction',
      'Stripe direction',
      ['Horizontal', 'Vertical', 'Diagonal /', 'Diagonal \\'],
      2,
      {
        group: 'Stripes & rings',
      },
    ),
    param.int('rings', 'Rings', 6, 1, 24, { group: 'Stripes & rings' }),
    param.int('arms', 'Swirl arms', 2, 1, 12, { group: 'Swirl' }),
    param.float('twist', 'Swirl twist', 3, -10, 10, { group: 'Swirl' }),
    param.float('streaks', 'Streaks', 24, 2, 96, { group: 'Glow', step: 1 }),
    param.float('streakAmount', 'Streak amount', 0.6, 0, 1, { group: 'Glow' }),
    param.speed(0, 2),
  ],
  presets: [
    { name: 'Soft dots', values: { mode: 0, cells: 2, offsetRows: true } },
    { name: 'Diamond glow', values: { mode: 1, cells: 1, sharpness: 0.6 } },
    { name: 'Diagonal sheen', values: { mode: 2, cells: 4, direction: 2, sharpness: 2 } },
    { name: 'Thin scanlines', values: { mode: 2, cells: 24, direction: 0, sharpness: 4 } },
    { name: 'Spiral vortex', values: { mode: 3, arms: 3, twist: 4, speed: 0.3 } },
    { name: 'Ripple cells', values: { mode: 4, cells: 2, rings: 8, offsetRows: true } },
    { name: 'Rising glow', values: { mode: 5, streaks: 32, streakAmount: 0.7 } },
  ],
  featuredPreset: 'Ripple cells',
};

export const hatching: ShaderGenerator = {
  kind: 'shader',
  id: 'hatching',
  name: 'Hatching',
  category: 'pattern',
  description:
    'Pen-and-ink shading strokes (single, cross or triple hatching) with dash, taper and ' +
    'pressure variation. Seamless sketch textures.',
  animated: false,
  fragment: hatchingFrag,
  params: [
    param.select(
      'direction',
      'Direction',
      ['Horizontal', 'Vertical', 'Diagonal /', 'Diagonal \\'],
      2,
    ),
    param.select('layers', 'Layers', ['Single', 'Cross', 'Triple'], 0),
    param.int('density', 'Lines', 32, 4, 128),
    param.float('dashLength', 'Dash length', 3, 0.3, 16, { description: 'In line spacings.' }),
    param.float('coverage', 'Coverage', 0.75, 0, 1),
    param.float('thickness', 'Thickness', 0.35, 0.05, 0.95),
    param.float('taper', 'Taper', 0.5, 0, 1),
    param.float('pressure', 'Pressure variation', 0.5, 0, 1),
    param.float('jitter', 'Row jitter', 0.3, 0, 0.8),
  ],
  presets: [
    { name: 'Diagonal sketch', values: { direction: 2, layers: 0, density: 32 } },
    { name: 'Cross hatch', values: { direction: 2, layers: 1, density: 40, coverage: 0.7 } },
    { name: 'Dense shading', values: { direction: 3, layers: 2, density: 56, thickness: 0.5 } },
    {
      name: 'Speed strokes',
      values: { direction: 0, density: 48, dashLength: 8, coverage: 0.5, taper: 0.9 },
    },
    {
      name: 'Stipple dashes',
      values: { direction: 2, density: 64, dashLength: 0.6, coverage: 0.5 },
    },
  ],
  featuredPreset: 'Cross hatch',
};

export const spots: ShaderGenerator = {
  kind: 'shader',
  id: 'spots',
  name: 'Spots & Camo',
  category: 'pattern',
  description: 'Seamless leopard rosettes, cheetah dots, woodland camo and scattered spores.',
  animated: false,
  fragment: spotsFrag,
  params: [
    param.select('mode', 'Pattern', ['Leopard', 'Cheetah', 'Camo', 'Spores'], 0),
    param.int('scale', 'Scale', 6, 1, 32),
    param.float('size', 'Spot size', 0.6, 0.1, 1),
    param.float('irregularity', 'Irregularity', 0.5, 0, 1.5),
    param.float('ringWidth', 'Ring width', 0.4, 0.1, 1, { group: 'Leopard' }),
    param.float('coverage', 'Coverage', 0.6, 0, 1, {
      description: 'Rosette ring continuity, or how many spores appear.',
    }),
    param.int('levels', 'Camo tones', 3, 1, 4, { group: 'Camo' }),
  ],
  presets: [
    { name: 'Leopard', values: { mode: 0, scale: 6, size: 0.6 } },
    { name: 'Cheetah', values: { mode: 1, scale: 10, size: 0.45, irregularity: 0.6 } },
    { name: 'Woodland camo', values: { mode: 2, scale: 3, levels: 3, size: 0.5 } },
    { name: 'Digital blotches', values: { mode: 2, scale: 4, levels: 2, irregularity: 0.2 } },
    { name: 'Spores', values: { mode: 3, scale: 8, coverage: 0.8, size: 0.7 } },
  ],
  featuredPreset: 'Leopard',
};

export const brushedMetal: ShaderGenerator = {
  kind: 'shader',
  id: 'brushed-metal',
  name: 'Brushed Metal',
  category: 'material',
  description: 'Fine streaks of brushed metal: linear (seamless) or radial (spun disc).',
  animated: false,
  layout: 'tiled',
  fragment: brushedMetalFrag,
  params: [
    param.select('style', 'Style', ['Linear', 'Radial (spun)'], 0),
    param.int('density', 'Density', 64, 4, 256, { description: 'Streak rows (or rings).' }),
    param.float('amount', 'Contrast', 0.5, 0, 1),
  ],
  presets: [
    { name: 'Brushed steel', values: { style: 0, density: 96, amount: 0.5 } },
    { name: 'Coarse grain', values: { style: 0, density: 24, amount: 0.8 } },
    { name: 'Spun disc', values: { style: 1, density: 160, amount: 0.6 } },
  ],
  featuredPreset: 'Brushed steel',
};

export const scratches: ShaderGenerator = {
  kind: 'shader',
  id: 'scratches',
  name: 'Scratches',
  category: 'material',
  description: 'Seamless straight scratches with a main direction (worn metal, glass, plastic).',
  animated: false,
  layout: 'tiled',
  fragment: scratchesFrag,
  params: [
    param.int('density', 'Density', 64, 4, 256, { description: 'Scratch cells (×4).' }),
    param.float('amount', 'Amount', 0.5, 0, 1, { description: 'Share of cells with a scratch.' }),
    param.float('angle', 'Angle', 20, 0, 180, { unit: '°' }),
    param.float('spread', 'Angle spread', 0.3, 0, 1),
    param.float('length', 'Length', 1, 0.2, 3),
    param.float('width', 'Width', 0.5, 0.05, 2),
  ],
  presets: [
    { name: 'Light scratches', values: { density: 32, amount: 0.35, spread: 0.6 } },
    { name: 'Heavy wear', values: { density: 48, amount: 0.9, spread: 1, width: 0.8 } },
    { name: 'Combed', values: { density: 96, amount: 0.8, spread: 0.05, length: 2.5, width: 0.3 } },
  ],
  featuredPreset: 'Heavy wear',
};

export const crackedGlass: ShaderGenerator = {
  kind: 'shader',
  id: 'cracked-glass',
  name: 'Cracked Glass',
  category: 'material',
  description: 'Shattered glass from an impact: radial cracks, spider-web chords, crushed core.',
  animated: false,
  layout: 'centered',
  fragment: crackedGlassFrag,
  params: [
    param.int('cracks', 'Radial cracks', 14, 3, 40),
    param.float('amount', 'Web density', 0.5, 0, 1, {
      description: 'Share of concentric chords between the radial cracks.',
    }),
    param.float('length', 'Size', 1, 0.2, 3),
    param.float('width', 'Width', 0.5, 0.05, 2),
  ],
  presets: [
    { name: 'Shattered glass', values: { cracks: 16, amount: 0.7, width: 0.6 } },
    { name: 'Bullet hole', values: { cracks: 11, amount: 0.5, length: 0.5, width: 0.4 } },
    { name: 'Spider web crack', values: { cracks: 22, amount: 0.95, length: 1.6, width: 0.5 } },
  ],
  featuredPreset: 'Shattered glass',
};

export const imageNode: ShaderGenerator = {
  kind: 'shader',
  id: 'image',
  name: 'Image',
  category: 'pattern',
  description:
    'Your own picture as a node (load or drop a file): plug it into Base, Mask, Warp or a ' +
    'simulation Emitter, or recolor it with the Post Process.',
  animated: false,
  layout: 'centered',
  fragment: imageFrag,
  params: [
    param.image('image', 'Image', {
      description: 'PNG / JPEG / WebP, downscaled to 1024 px and stored in the document.',
    }),
    param.select('fit', 'Fit', ['Stretch', 'Tile', 'Contain', 'Cover'], 3),
    param.int('tiles', 'Tiles', 2, 1, 16, { description: 'Repeats per side (Tile fit).' }),
    param.float('zoom', 'Zoom', 1, 0.1, 8),
    param.vec2('offset', 'Offset', [0, 0], -1, 1, { step: 0.01 }),
    param.bool('repeat', 'Repeat outside', false, {
      description: 'Wrap the image instead of leaving transparent borders.',
    }),
    param.select('channel', 'Channel', ['Color', 'Luminance', 'Alpha'], 0),
  ],
  // Colors as imported: source color mode and source alpha.
  defaultPost: { colorMode: 0, alphaMode: 3 },
  presets: [
    { name: 'Fit (cover)', values: { fit: 3 } },
    { name: 'Whole image', values: { fit: 2 } },
    { name: 'Tiled', values: { fit: 1, tiles: 3 } },
    { name: 'Grayscale mask', values: { fit: 3, channel: 1 } },
  ],
  featuredPreset: 'Fit (cover)',
};

export const MOTIF_PATTERNS = [
  imageNode,
  geoPattern,
  softMasks,
  hatching,
  spots,
  brushedMetal,
  scratches,
  crackedGlass,
];
