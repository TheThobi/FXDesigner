/**
 * Operators: nodes that transform or combine other nodes' images (Substance Designer-like
 * utilities). They are shader generators of the 'operator' category with declared `inputs`,
 * laid out 'centered' so they sample their inputs at the node's own uv. Their Post Process
 * defaults to a neutral pass-through (source colors and alpha, no module).
 */
import type { ShaderGenerator, ShaderPass } from '../../engine/generator';
import type { NodeInputDef, NodeOutputDef, NodeValueType } from '../../engine/nodes';
import { param } from '../../params/define';
import type { ParamDef, ParamValues, Preset } from '../../params/types';
import { GRADIENTS } from '../../params/gradientPresets';
import { getNumber } from '../../params/values';
import blendFrag from './blend.glsl?raw';
import blurPassFrag from './blur-pass.glsl?raw';
import blurFrag from './blur.glsl?raw';
import customFrag from './custom.glsl?raw';
import distanceJumpFrag from './distance-jump.glsl?raw';
import distanceSeedFrag from './distance-seed.glsl?raw';
import distanceFrag from './distance.glsl?raw';
import edgesFrag from './edges.glsl?raw';
import levelsFrag from './levels.glsl?raw';
import maskFrag from './mask.glsl?raw';
import packFrag from './pack.glsl?raw';
import slopeBlurFrag from './slope-blur.glsl?raw';
import transformFrag from './transform.glsl?raw';
import unpackFrag from './unpack.glsl?raw';
import colorCycleFrag from './color-cycle.glsl?raw';
import dissolveFrag from './dissolve.glsl?raw';
import flickerFrag from './flicker.glsl?raw';
import hueShiftFrag from './hue-shift.glsl?raw';
import scrollFrag from './scroll.glsl?raw';
import warpFrag from './warp.glsl?raw';

export const BLEND_MODES = [
  'Normal',
  'Add',
  'Subtract',
  'Multiply',
  'Screen',
  'Overlay',
  'Lighten',
  'Darken',
  'Difference',
  'Divide',
] as const;

/** Source colors, source alpha: operators pass their result through untouched by default. */
const PASS_THROUGH: ParamValues = { colorMode: 0, alphaMode: 3 };

const input = (
  key: string,
  label: string,
  description: string,
  color: string,
  value?: NodeValueType,
): NodeInputDef => ({ key, label, description, color, ...(value ? { value } : {}) });
const IMAGE = input('image', 'Image', 'The image to process.', '#e8e8e8');

function operator(spec: {
  id: string;
  name: string;
  description: string;
  fragment: string;
  inputs: readonly NodeInputDef[];
  params: readonly ParamDef[];
  presets: readonly Preset[];
  codeParam?: string;
  passes?: readonly ShaderPass[];
  outputs?: readonly NodeOutputDef[];
  /** Animation operators: category 'animation', time-dependent. */
  category?: 'operator' | 'animation';
  animated?: boolean;
  defaultPost?: ParamValues;
}): ShaderGenerator {
  return {
    kind: 'shader',
    category: 'operator',
    animated: false,
    layout: 'centered',
    defaultPost: PASS_THROUGH,
    featuredPreset: spec.presets[0]?.name,
    ...spec,
  };
}

export const blendOp = operator({
  id: 'op-blend',
  name: 'Blend',
  description: 'Foreground over Background with a blend mode, opacity and optional mask.',
  fragment: blendFrag,
  inputs: [
    input('foreground', 'Foreground', 'Image blended on top.', '#e8e8e8'),
    input('background', 'Background', 'Image underneath.', '#a0a0a0'),
    input('mask', 'Mask', 'Brightness limits where the foreground shows.', '#9be86a', 'gray'),
  ],
  params: [
    param.select('mode', 'Mode', BLEND_MODES, 0),
    param.float('opacity', 'Opacity', 1, 0, 1),
    param.bool('invertMask', 'Invert mask', false),
  ],
  presets: [
    { name: 'Normal', values: { mode: 0 } },
    { name: 'Add (glow)', values: { mode: 1 } },
    { name: 'Multiply (shade)', values: { mode: 3 } },
    { name: 'Overlay', values: { mode: 5 } },
    { name: 'Difference', values: { mode: 8 } },
  ],
});

export const maskOp = operator({
  id: 'op-mask',
  name: 'Mask',
  description: 'Cuts the Image with a Mask (luminance, alpha or red), with levels and invert.',
  fragment: maskFrag,
  inputs: [IMAGE, input('mask', 'Mask', 'White keeps, black removes.', '#9be86a', 'gray')],
  params: [
    param.select('channel', 'Mask channel', ['Luminance', 'Alpha', 'Red'], 0),
    param.float('low', 'Low', 0, 0, 1),
    param.float('high', 'High', 1, 0, 1),
    param.bool('invert', 'Invert', false),
  ],
  presets: [
    { name: 'Soft mask', values: {} },
    { name: 'Hard cut', values: { low: 0.49, high: 0.51 } },
    { name: 'Inverted', values: { invert: true } },
  ],
});

export const levelsOp = operator({
  id: 'op-levels',
  name: 'Levels & Math',
  description: 'Levels, gamma, power, multiply, add, fold, threshold, invert and clamp.',
  fragment: levelsFrag,
  inputs: [IMAGE],
  params: [
    param.float('inLow', 'Input low', 0, 0, 1, { group: 'Levels' }),
    param.float('inHigh', 'Input high', 1, 0, 1, { group: 'Levels' }),
    param.float('gamma', 'Gamma', 1, 0.1, 5, { group: 'Levels' }),
    param.float('outLow', 'Output low', 0, 0, 1, { group: 'Levels' }),
    param.float('outHigh', 'Output high', 1, 0, 1, { group: 'Levels' }),
    param.float('power', 'Power', 1, 0.1, 8, { group: 'Math' }),
    param.float('gain', 'Multiply', 1, 0, 4, { group: 'Math' }),
    param.float('bias', 'Add', 0, -1, 1, { group: 'Math' }),
    param.bool('fold', 'Fold', false, {
      group: 'Math',
      description: 'Mirror around 0.5: |2v − 1| (gradients become ridges).',
    }),
    param.float('threshold', 'Threshold', 0, 0, 1, { group: 'Math', description: '0 = off.' }),
    param.float('softness', 'Threshold softness', 0.02, 0, 0.5, { group: 'Math' }),
    param.bool('invert', 'Invert', false, { group: 'Math' }),
    param.bool('clampValue', 'Clamp 0..1', true, { group: 'Math' }),
  ],
  presets: [
    { name: 'Identity', values: {} },
    { name: 'Invert', values: { invert: true } },
    { name: 'High contrast', values: { inLow: 0.3, inHigh: 0.7 } },
    { name: 'Ridges', values: { fold: true, power: 0.6 } },
    { name: 'Threshold', values: { threshold: 0.5, softness: 0.02 } },
  ],
});

export const transformOp = operator({
  id: 'op-transform',
  name: 'Transform 2D',
  description: 'Tile, rotate, scale, flip and offset an image (seamless with wrap).',
  fragment: transformFrag,
  inputs: [IMAGE],
  params: [
    param.int('tile', 'Tile', 1, 1, 16),
    param.angle('rotation', 'Rotation', 0),
    param.float('scale', 'Scale', 1, 0.05, 8),
    param.vec2('offset', 'Offset', [0, 0], -1, 1, { step: 0.01 }),
    param.bool('flipX', 'Flip X', false),
    param.bool('flipY', 'Flip Y', false),
    param.bool('wrap', 'Wrap', true, { description: 'Repeat outside the image (else clear).' }),
  ],
  presets: [
    { name: 'Identity', values: {} },
    { name: 'Tile 2×2', values: { tile: 2 } },
    { name: 'Quarter turn', values: { rotation: 90 } },
    { name: 'Mirror', values: { flipX: true } },
  ],
});

export const warpOp = operator({
  id: 'op-warp',
  name: 'Warp',
  description:
    'Displaces an image by another: along its slopes, by an RG vector map (flowmap) or in a ' +
    'fixed direction scaled by its brightness.',
  fragment: warpFrag,
  inputs: [IMAGE, input('warp', 'Warp', 'The displacement map.', '#5ad0ff')],
  params: [
    param.select('mode', 'Mode', ['Slope', 'Vector (RG)', 'Directional'], 0),
    param.float('intensity', 'Intensity', 0.3, 0, 4),
    param.angle('angle', 'Direction', 0, { description: 'Directional mode.' }),
  ],
  presets: [
    { name: 'Slope warp', values: { mode: 0, intensity: 0.3 } },
    { name: 'Flowmap', values: { mode: 1, intensity: 0.5 } },
    { name: 'Directional', values: { mode: 2, intensity: 0.6, angle: 45 } },
  ],
});

export const blurOp = operator({
  id: 'op-blur',
  name: 'Blur',
  description:
    'Gaussian or directional (motion) blur; sampling adapts to the radius (smooth at any ' +
    'size); wraps around the edges.',
  fragment: blurFrag,
  passes: [
    {
      label: 'gaussian',
      fragment: blurPassFrag,
      // Two passes (H + V) per level; levels double the blur until the radius is reached.
      repeat: (values, width, height) => {
        if (getNumber(values, 'mode') !== 0) return 0;
        const sigma = (getNumber(values, 'radius') * 0.5 * Math.max(width, height)) / 512;
        return 2 * Math.max(1, Math.ceil(Math.log2((sigma * Math.sqrt(3)) / 4)));
      },
    },
  ],
  inputs: [IMAGE],
  params: [
    param.select('mode', 'Mode', ['Gaussian', 'Directional'], 0),
    param.float('radius', 'Radius', 8, 0, 256, { unit: 'px' }),
    param.angle('angle', 'Direction', 0, { description: 'Directional mode.' }),
  ],
  presets: [
    { name: 'Soft', values: { radius: 6 } },
    { name: 'Heavy', values: { radius: 48 } },
    { name: 'Huge', values: { radius: 200 } },
    { name: 'Motion', values: { mode: 1, radius: 40 } },
  ],
});

export const slopeBlurOp = operator({
  id: 'op-slope-blur',
  name: 'Slope Blur',
  description:
    'Smears the Image along the slopes of another image (Substance slope blur): painterly ' +
    'strokes, eroded or swollen edges.',
  fragment: slopeBlurFrag,
  inputs: [IMAGE, input('slope', 'Slope', 'Its gradients steer the blur.', '#5ad0ff', 'gray')],
  params: [
    param.select('mode', 'Mode', ['Blur', 'Min (erode)', 'Max (grow)'], 0),
    param.float('intensity', 'Intensity', 12, 0, 64, { unit: 'px' }),
    param.int('samples', 'Samples', 12, 1, 64, {
      description: 'Steps along the slope: more gives longer, smoother strokes.',
    }),
  ],
  presets: [
    { name: 'Painterly', values: { mode: 0, intensity: 12 } },
    { name: 'Erode', values: { mode: 1, intensity: 8 } },
    { name: 'Grow', values: { mode: 2, intensity: 8 } },
  ],
});

export const distanceOp = operator({
  id: 'op-distance',
  name: 'Distance',
  description:
    'Exact distance field of the shapes of a mask (Substance-like): gradients around or ' +
    'inside shapes, bevels, signed fields; a Source spreads its colors from the shapes.',
  fragment: distanceFrag,
  passes: [
    { label: 'seed', fragment: distanceSeedFrag, precise: true },
    {
      label: 'jump',
      fragment: distanceJumpFrag,
      precise: true,
      // Jump flood: steps 2^(k-1) … 1 covering Max distance, plus a final step of 1.
      repeat: (values, width, height) => {
        const px = (getNumber(values, 'maxDistance') * Math.max(width, height)) / 512;
        const cover = Math.ceil(Math.log2(Math.max(2, px)));
        return Math.min(cover, Math.ceil(Math.log2(Math.max(width, height)))) + 1;
      },
    },
  ],
  inputs: [
    input(
      'mask',
      'Mask',
      'White shapes to measure from (brightness > threshold).',
      '#9be86a',
      'gray',
    ),
    {
      ...input('source', 'Source', 'Optional: its colors spread from the shapes.', '#ffb347'),
      params: ['combine'],
    },
  ],
  params: [
    param.select('mode', 'Mode', ['Outside', 'Inside (bevel)', 'Signed'], 0),
    param.float('maxDistance', 'Max distance', 48, 1, 512, { unit: 'px' }),
    param.float('threshold', 'Threshold', 0.5, 0, 1),
    param.float('falloff', 'Falloff', 1, 0.2, 6, { description: 'Curve of the gradient.' }),
    param.bool('tile', 'Tiling', true, {
      description: 'Distances wrap around the edges (seamless).',
    }),
    param.bool('combine', 'Fade source with distance', false, {
      description: 'Source connected: multiply its spread colors by the gradient.',
    }),
  ],
  presets: [
    { name: 'Gradient around', values: { mode: 0, maxDistance: 48 } },
    { name: 'Bevel', values: { mode: 1, maxDistance: 8 } },
    { name: 'Signed field', values: { mode: 2, maxDistance: 64 } },
    { name: 'Soft glow', values: { mode: 0, maxDistance: 96, falloff: 2.5 } },
  ],
});

export const edgesOp = operator({
  id: 'op-edges',
  name: 'Edge Detect',
  description: 'Bright lines where the Image changes (Sobel).',
  fragment: edgesFrag,
  inputs: [IMAGE],
  params: [
    param.float('width', 'Width', 1.5, 0.5, 16, { unit: 'px' }),
    param.float('strength', 'Strength', 2, 0.1, 10),
    param.float('threshold', 'Threshold', 0.1, 0, 1),
  ],
  presets: [
    { name: 'Fine lines', values: { width: 1, strength: 3 } },
    { name: 'Thick outline', values: { width: 4, strength: 2, threshold: 0.2 } },
  ],
});

const output = (
  key: string,
  label: string,
  channel: NodeOutputDef['channel'],
  color: string,
): NodeOutputDef => ({
  key,
  label,
  description: `The ${label.toLowerCase()} channel as a grayscale image.`,
  color,
  channel,
});

export const unpackOp = operator({
  id: 'op-unpack',
  name: 'Unpack RGBA',
  description: 'Splits an image into its R, G, B and A channels: one grayscale output each.',
  fragment: unpackFrag,
  inputs: [IMAGE],
  outputs: [
    output('r', 'Red', 0, '#ff6b6b'),
    output('g', 'Green', 1, '#6bff8a'),
    output('b', 'Blue', 2, '#6bb5ff'),
    output('a', 'Alpha', 3, '#e8e8e8'),
  ],
  params: [],
  presets: [{ name: 'Split channels', values: {} }],
});

export const packOp = operator({
  id: 'op-pack',
  name: 'Pack RGBA',
  description:
    'Packs four grayscale masks into the R, G, B and A channels of one texture (export with ' +
    'source colors).',
  fragment: packFrag,
  inputs: [
    input('red', 'Red', 'Stored in R.', '#ff6b6b', 'gray'),
    input('green', 'Green', 'Stored in G.', '#6bff8a', 'gray'),
    input('blue', 'Blue', 'Stored in B.', '#6bb5ff', 'gray'),
    input('alpha', 'Alpha', 'Stored in A (opaque when unconnected).', '#e8e8e8', 'gray'),
  ],
  params: [
    param.bool('preview', 'Opaque preview', false, {
      description: 'Ignore the alpha input in the preview (it can hide everything).',
    }),
  ],
  presets: [{ name: 'Packed', values: {} }],
});

export const customOp = operator({
  id: 'op-custom',
  name: 'Custom Code',
  description:
    'Your own GLSL per pixel: edit `vec4 v` (starts as input A). Available: a(uv), b(uv), ' +
    'c(uv), uv, t (seconds), px (one pixel), noise helpers (fbm, gradientNoise, voronoi…).',
  fragment: customFrag,
  codeParam: 'code',
  inputs: [
    input('a', 'A', 'Read with a(uv); also the starting value of v.', '#e8e8e8'),
    input('b', 'B', 'Read with b(uv).', '#ffb347'),
    input('c', 'C', 'Read with c(uv).', '#c08cff'),
  ],
  params: [
    param.text('code', 'GLSL', 'v.rgb = 1.0 - v.rgb;', {
      multiline: true,
      maxLength: 4000,
      description: 'Ctrl+Enter applies. Compile errors appear on the node.',
    }),
  ],
  presets: [
    { name: 'Invert', values: { code: 'v.rgb = 1.0 - v.rgb;' } },
    { name: 'Multiply A × B', values: { code: 'v = a(uv) * b(uv);' } },
    {
      name: 'Stripes from A',
      values: { code: 'v.rgb = vec3(step(0.5, fract(uv.x * 8.0 + v.r)));\nv.a = 1.0;' },
    },
    {
      name: 'Height to normal',
      values: {
        code:
          'float hx = a(uv + vec2(px.x, 0.0)).r - a(uv - vec2(px.x, 0.0)).r;\n' +
          'float hy = a(uv + vec2(0.0, px.y)).r - a(uv - vec2(0.0, px.y)).r;\n' +
          'v = vec4(normalize(vec3(-hx, -hy, 0.05)) * 0.5 + 0.5, 1.0);',
      },
    },
  ],
});

// ---- Animation operators (time-dependent: Substance has none, everything there is static) --

const animation = (spec: Parameters<typeof operator>[0]) =>
  operator({ category: 'animation', animated: true, ...spec });

export const hueShiftOp = animation({
  id: 'op-hue-shift',
  name: 'Hue Shift',
  description: 'Rotates the hue over time; Spread makes rainbow bands travel with brightness.',
  fragment: hueShiftFrag,
  inputs: [IMAGE],
  params: [
    param.float('speed', 'Speed', 0.1, -2, 2, { description: 'Turns of the color wheel / s.' }),
    param.float('offset', 'Offset', 0, 0, 360, { unit: '°' }),
    param.float('spread', 'Spread', 0, 0, 3, { description: 'Hue change with brightness.' }),
    param.float('saturation', 'Saturation', 1, 0, 3),
  ],
  presets: [
    { name: 'Slow drift', values: { speed: 0.05 } },
    { name: 'Rainbow bands', values: { speed: 0.3, spread: 1.5, saturation: 1.6 } },
    { name: 'Static tint', values: { speed: 0, offset: 120 } },
  ],
});

export const colorCycleOp = animation({
  id: 'op-color-cycle',
  name: 'Color Cycle',
  description:
    'Palette cycling: brightness scrolls through this node’s color ramp over time (lava, ' +
    'water, energy, neon) without redrawing anything.',
  fragment: colorCycleFrag,
  // The node's own ramp (Post Process gradient map) is the palette.
  defaultPost: { colorMode: 1, alphaMode: 3 },
  inputs: [IMAGE],
  params: [
    param.float('speed', 'Speed', 0.25, -3, 3, { description: 'Palette loops / s.' }),
    param.int('repeats', 'Repeats', 1, 1, 12, { description: 'Palette bands across the image.' }),
    param.bool('mirror', 'Mirror', true, {
      description: 'There and back through the ramp: no hard jump between its ends.',
    }),
  ],
  presets: [
    { name: 'Lava flow', values: { speed: 0.2, repeats: 2 }, ramp: GRADIENTS.magma },
    { name: 'Water shimmer', values: { speed: 0.5, repeats: 3 }, ramp: GRADIENTS.lagoon },
    {
      name: 'Neon rainbow',
      values: { speed: 0.4, repeats: 1, mirror: false },
      ramp: GRADIENTS.spectrum,
    },
  ],
});

export const flickerOp = animation({
  id: 'op-flicker',
  name: 'Flicker',
  description:
    'Brightness or opacity pulses over time: sine, candle-like noise or strobe; Local makes ' +
    'each area flicker on its own.',
  fragment: flickerFrag,
  inputs: [IMAGE],
  params: [
    param.select('wave', 'Wave', ['Sine', 'Noise', 'Strobe'], 1),
    param.float('speed', 'Speed', 2, 0.05, 12, { description: 'Cycles / s.' }),
    param.float('amount', 'Amount', 0.5, 0, 1),
    param.float('local', 'Local', 0, 0, 1, { description: 'Phase varies across the image.' }),
    param.bool('opacity', 'Affect opacity', false, {
      description: 'Fade the alpha instead of the brightness.',
    }),
  ],
  presets: [
    { name: 'Candle', values: { wave: 1, speed: 3, amount: 0.4 } },
    { name: 'Breathing', values: { wave: 0, speed: 0.5, amount: 0.6 } },
    { name: 'Shimmer', values: { wave: 0, speed: 1.5, amount: 0.5, local: 1 } },
    { name: 'Strobe', values: { wave: 2, speed: 6, amount: 1, opacity: true } },
  ],
});

export const scrollOp = animation({
  id: 'op-scroll',
  name: 'Scroll',
  description:
    'Pans the image over time, wrapping around (seamless inputs scroll endlessly), with an ' +
    'optional sway.',
  fragment: scrollFrag,
  inputs: [IMAGE],
  params: [
    param.float('speedX', 'Speed X', 0, -2, 2, { description: 'Tiles / s.' }),
    param.float('speedY', 'Speed Y', 0.25, -2, 2, { description: 'Tiles / s.' }),
    param.float('sway', 'Sway', 0, 0, 2),
    param.int('swayWaves', 'Sway waves', 2, 1, 8),
    param.float('swaySpeed', 'Sway speed', 0.5, 0, 4),
  ],
  presets: [
    { name: 'Rising', values: { speedX: 0, speedY: 0.25 } },
    { name: 'Diagonal drift', values: { speedX: 0.1, speedY: 0.1 } },
    { name: 'Heat haze', values: { speedY: 0.1, sway: 0.6, swayWaves: 4, swaySpeed: 1 } },
  ],
});

export const dissolveOp = animation({
  id: 'op-dissolve',
  name: 'Dissolve',
  description:
    'The image burns away (and back) over time through a threshold on the Pattern input, with ' +
    'a glowing edge. Without a pattern: a left-to-right wipe.',
  fragment: dissolveFrag,
  inputs: [
    IMAGE,
    input(
      'pattern',
      'Pattern',
      'Dark parts go first (noise, gradient, Distance…).',
      '#c08cff',
      'gray',
    ),
  ],
  params: [
    param.float('speed', 'Speed', 0.25, 0.02, 4, { description: 'Cycles / s.' }),
    param.float('edge', 'Edge width', 0.08, 0, 0.5),
    param.float('glow', 'Edge glow', 2, 0, 8),
    param.color('glowColor', 'Glow color', '#ff7a1a'),
    param.bool('pingPong', 'Ping-pong', true, { description: 'Disappear, then reappear.' }),
    param.bool('invert', 'Invert pattern', false),
  ],
  presets: [
    { name: 'Burn away', values: { glow: 3, glowColor: '#ff7a1a' } },
    { name: 'Magic fade', values: { glow: 2, glowColor: '#7ad7ff', edge: 0.15 } },
    { name: 'Hard cut', values: { glow: 0, edge: 0 } },
  ],
});

export const ANIMATION_OPERATORS: readonly ShaderGenerator[] = [
  hueShiftOp,
  colorCycleOp,
  flickerOp,
  scrollOp,
  dissolveOp,
];

export const OPERATORS: readonly ShaderGenerator[] = [
  blendOp,
  maskOp,
  levelsOp,
  transformOp,
  warpOp,
  blurOp,
  slopeBlurOp,
  distanceOp,
  edgesOp,
  unpackOp,
  packOp,
  customOp,
  ...ANIMATION_OPERATORS,
];
