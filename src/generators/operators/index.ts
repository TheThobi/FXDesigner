import mathFrag from './math.glsl?raw';
import manualLevelsFrag from './manual-levels.glsl?raw';
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
import autoLevelsFrag from './auto-levels.glsl?raw';
import autoLevelsRangeFrag from './auto-levels-range.glsl?raw';
import blurPassFrag from './blur-pass.glsl?raw';
import blurFrag from './blur.glsl?raw';
import customFrag from './custom.glsl?raw';
import distanceJumpFrag from './distance-jump.glsl?raw';
import distanceSeedFrag from './distance-seed.glsl?raw';
import distanceFrag from './distance.glsl?raw';
import edgesFrag from './edges.glsl?raw';
import edgeFadeFrag from './edge-fade.glsl?raw';
import maskFrag from './mask.glsl?raw';
import packFrag from './pack.glsl?raw';
import passthroughFrag from './passthrough.glsl?raw';
import materialOutputFrag from './material-output.glsl?raw';
import tileSamplerFrag from './tile-sampler.glsl?raw';
import floodSeedFrag from './flood-seed.glsl?raw';
import floodSpreadFrag from './flood-spread.glsl?raw';
import floodFillFrag from './flood-fill.glsl?raw';
import floodCommon from './flood-common.glsl?raw';
import floodGradientFrag from './flood-gradient.glsl?raw';
import floodSizeFrag from './flood-size.glsl?raw';
import floodColorFrag from './flood-color.glsl?raw';
import floodMapperFrag from './flood-mapper.glsl?raw';
import makeTileFrag from './make-tile.glsl?raw';
import radialBlurFrag from './radial-blur.glsl?raw';
import polarFrag from './polar.glsl?raw';
import curvatureFrag from './curvature.glsl?raw';
import heightBlendFrag from './height-blend.glsl?raw';
import glowFrag from './glow.glsl?raw';
import trimSheetFrag from './trim-sheet.glsl?raw';
import slopeBlurFrag from './slope-blur.glsl?raw';
import transformFrag from './transform.glsl?raw';
import unpackFrag from './unpack.glsl?raw';
import colorCycleFrag from './color-cycle.glsl?raw';
import dissolveFrag from './dissolve.glsl?raw';
import flickerFrag from './flicker.glsl?raw';
import hueShiftFrag from './hue-shift.glsl?raw';
import scrollFrag from './scroll.glsl?raw';
import warpFrag from './warp.glsl?raw';
import { uniform } from './uniform';

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
  /** None for plumbing nodes (Output, Pack…): no preset gallery. */
  presets?: readonly Preset[];
  codeParam?: string;
  passes?: readonly ShaderPass[];
  outputs?: readonly NodeOutputDef[];
  /** Animation operators: category 'animation', time-dependent. */
  category?: 'operator' | 'animation';
  animated?: boolean;
  defaultPost?: ParamValues;
  exportOverrides?: ParamValues;
  role?: 'output' | 'reroute';
  startCollapsed?: boolean;
}): ShaderGenerator {
  return {
    kind: 'shader',
    category: 'operator',
    animated: false,
    layout: 'centered',
    defaultPost: PASS_THROUGH,
    ...(spec.presets?.[0] ? { featuredPreset: spec.presets[0].name } : {}),
    ...spec,
  };
}

export const blendOp = operator({
  id: 'op-blend',
  name: 'Blend',
  description: 'Composite with Normal or combine channels with a blend mode, opacity and mask.',
  fragment: blendFrag,
  inputs: [
    input('foreground', 'Foreground', 'Image blended on top.', '#e8e8e8'),
    input('background', 'Background', 'Image underneath.', '#a0a0a0'),
    input('mask', 'Mask', 'Brightness limits where the foreground shows.', '#9be86a', 'float'),
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
  inputs: [IMAGE, input('mask', 'Mask', 'White keeps, black removes.', '#9be86a', 'float')],
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

const LEVEL_PARAMS = [
  param.float('inLow', 'Input low', 0, 0, 1, { group: 'Levels' }),
  param.float('inHigh', 'Input high', 1, 0, 1, { group: 'Levels' }),
  param.float('gamma', 'Gamma', 1, 0.1, 5, { group: 'Levels' }),
  param.float('outLow', 'Output low', 0, 0, 1, { group: 'Levels' }),
  param.float('outHigh', 'Output high', 1, 0, 1, { group: 'Levels' }),
];
const MATH_PARAMS = [
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
];

export const manualLevelsOp = operator({
  id: 'op-level',
  name: 'Levels',
  description: 'Remap the black and white points and adjust the midtones.',
  fragment: manualLevelsFrag,
  inputs: [IMAGE],
  params: LEVEL_PARAMS,
  presets: [
    { name: 'Identity', values: {} },
    { name: 'High contrast', values: { inLow: 0.3, inHigh: 0.7 } },
  ],
});

export const mathOp = operator({
  id: 'op-math',
  name: 'Math',
  description: 'Power, multiply, add, fold, threshold, invert and clamp.',
  fragment: mathFrag,
  inputs: [IMAGE],
  params: MATH_PARAMS,
  presets: [
    { name: 'Identity', values: {} },
    { name: 'Invert', values: { invert: true } },
    { name: 'Ridges', values: { fold: true, power: 1.2 } },
  ],
});

export const autoLevelsOp = operator({
  id: 'op-auto-levels',
  name: 'Auto Levels',
  description: 'Adjusts contrast from the darkest and brightest pixels. Keeps hue and alpha.',
  fragment: autoLevelsFrag,
  inputs: [IMAGE],
  passes: [
    {
      label: 'range',
      fragment: autoLevelsRangeFrag,
      precise: true,
      repeat: (params, _width, _height, inputs) => {
        const image = inputs?.image;
        if (!image || params.strength === 0) return 0;
        return Math.max(1, Math.ceil(Math.log2(Math.max(image.width, image.height)) / 2));
      },
      size: (width, height, iteration, inputs) => {
        const divisor = 4 ** (iteration + 1);
        return [
          Math.ceil((inputs?.image?.width ?? width) / divisor),
          Math.ceil((inputs?.image?.height ?? height) / divisor),
        ];
      },
    },
  ],
  params: [
    param.float('strength', 'Strength', 1, 0, 1, { limit: [0, 1] }),
    param.float('outBlack', 'Output black', 0, 0, 1, { limit: [0, 1] }),
    param.float('outWhite', 'Output white', 1, 0, 1, { limit: [0, 1] }),
    param.bool('ignoreTransparent', 'Ignore transparent pixels', true),
  ],
  presets: [
    { name: 'Full range', values: {} },
    { name: 'Gentle stretch', values: { strength: 0.5 } },
    { name: 'Soft blacks and whites', values: { outBlack: 0.08, outWhite: 0.92 } },
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
  inputs: [IMAGE, input('slope', 'Slope', 'Its gradients steer the blur.', '#5ad0ff', 'float')],
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
    'Distance fields inside or around a mask. An optional Source spreads colors from the shapes.',
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
      'float',
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
});

export const packOp = operator({
  id: 'op-pack',
  name: 'Pack RGBA',
  description: 'Packs masks into RGBA, using a constant for each empty input.',
  fragment: packFrag,
  exportOverrides: { preview: false },
  inputs: [
    {
      ...input('red', 'Red', 'Stored in R.', '#ff6b6b', 'float'),
      preview: 0,
      fallbackParams: ['redValue'],
    },
    {
      ...input('green', 'Green', 'Stored in G.', '#6bff8a', 'float'),
      preview: 1,
      fallbackParams: ['greenValue'],
    },
    {
      ...input('blue', 'Blue', 'Stored in B.', '#6bb5ff', 'float'),
      preview: 2,
      fallbackParams: ['blueValue'],
    },
    {
      ...input('alpha', 'Alpha', 'Stored in A.', '#e8e8e8', 'float'),
      preview: 3,
      fallbackParams: ['alphaValue'],
    },
  ],
  params: [
    param.bool('preview', 'Opaque preview', false, {
      description: 'Show the preview with full opacity. The export keeps the packed alpha.',
    }),
    param.float('redValue', 'Red', 0, 0, 1, { group: 'Unconnected inputs', limit: [0, 1] }),
    param.float('greenValue', 'Green', 0, 0, 1, { group: 'Unconnected inputs', limit: [0, 1] }),
    param.float('blueValue', 'Blue', 0, 0, 1, { group: 'Unconnected inputs', limit: [0, 1] }),
    param.float('alphaValue', 'Alpha', 1, 0, 1, { group: 'Unconnected inputs', limit: [0, 1] }),
  ],
});

export const outputOp = operator({
  id: 'output',
  name: 'Output',
  description:
    'Chooses what to export and show in the library. Falls back to the selected node when unconnected.',
  fragment: passthroughFrag,
  role: 'output',
  startCollapsed: true,
  inputs: [input('image', 'Image', 'The image to export.', '#e8e8e8')],
  params: [],
});

export const materialOutputOp = operator({
  id: 'material-output',
  name: 'Material Output',
  description:
    'Gathers a material for the 3D Preview: color, normal map, height and roughness from any nodes.',
  fragment: materialOutputFrag,
  inputs: [
    input('color', 'Color', 'Albedo (also what this node shows and exports).', '#e8e8e8'),
    input(
      'normal',
      'Normal',
      'Tangent-space normal map (OpenGL, Y up). Default: from Height.',
      '#ffd166',
      'vec3',
    ),
    input(
      'height',
      'Height',
      'Relief (bright = high). Default: the color brightness.',
      '#6bb5ff',
      'float',
    ),
    input(
      'roughness',
      'Roughness',
      'Bright = rough (dull), dark = glossy. Unconnected: 0.6 (connect a Uniform for a constant).',
      '#6bb5ff',
      'float',
    ),
  ],
  params: [],
});

export const rerouteOp = operator({
  id: 'reroute',
  name: 'Reroute',
  description: 'A dot that bends links (double-click a link to add one).',
  fragment: passthroughFrag,
  role: 'reroute',
  inputs: [input('image', 'In', 'Passed through.', '#e8e8e8')],
  params: [],
});

export const customOp = operator({
  id: 'op-custom',
  name: 'Custom Code',
  description: 'Apply your own GLSL to up to three inputs. The starting color is input A.',
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
  description: 'Scrolls image brightness through the color ramp over time.',
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
    'Dissolves along a pattern with a glowing edge. Without a pattern, wipes left to right.',
  fragment: dissolveFrag,
  inputs: [
    IMAGE,
    input(
      'pattern',
      'Pattern',
      'Dark parts go first (noise, gradient, Distance…).',
      '#c08cff',
      'float',
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

export const edgeFadeOp = operator({
  id: 'op-edge-fade',
  name: 'Edge Feather',
  description: 'Fade selected image edges with separate widths. A width of zero skips that edge.',
  fragment: edgeFadeFrag,
  inputs: [IMAGE],
  params: [
    param.float('left', 'Left width', 0.12, 0, 0.5, { group: 'Edges', limit: [0, 1] }),
    param.float('right', 'Right width', 0.12, 0, 0.5, { group: 'Edges', limit: [0, 1] }),
    param.float('top', 'Top width', 0.12, 0, 0.5, { group: 'Edges', limit: [0, 1] }),
    param.float('bottom', 'Bottom width', 0.12, 0, 0.5, { group: 'Edges', limit: [0, 1] }),
    param.select('curve', 'Curve', ['Linear', 'Smooth', 'Slow rise', 'Fast rise'], 1),
    param.select('corners', 'Corners', ['Strongest edge', 'Multiply'], 1),
    param.select('channels', 'Affect', ['Alpha', 'Color', 'Color and alpha'], 0),
    param.float('inset', 'Clear edge fraction', 0, 0, 0.95, { limit: [0, 0.99] }),
    param.float('amount', 'Amount', 1, 0, 1, { limit: [0, 1] }),
  ],
  presets: [
    { name: 'Soft border', values: {} },
    { name: 'Dissolve upward', values: { left: 0, right: 0, bottom: 0, top: 0.35 } },
    { name: 'Feathered sides', values: { top: 0, bottom: 0, left: 0.23, right: 0.23 } },
  ],
});

// ---- Substance / FluidNinja-inspired operators -----------------------------------------------

export const tileSamplerOp: ShaderGenerator = {
  ...operator({
    id: 'op-tile-sampler',
    name: 'Tile Sampler',
    description:
      'Scatters copies of a shape on a seamless grid with random offset, scale, rotation and ' +
      'brightness; a mask thins them out. Copies can move: drift, spin, wobble, pulse, ' +
      'twinkle or pop in and fade out, each with its own phase (loops with the timeline).',
    fragment: tileSamplerFrag,
    animated: true,
    inputs: [
      input('shape', 'Shape', 'The copied image (a soft disc when unconnected).', '#e8e8e8'),
      input('mask', 'Mask', 'Where copies may appear (bright = dense).', '#6bb5ff', 'float'),
    ],
    params: [
      param.int('count', 'Grid', 6, 1, 32, { description: 'Copies per row (and column).' }),
      param.float('density', 'Density', 1, 0, 1),
      param.float('jitter', 'Position jitter', 0.5, 0, 1),
      param.float('scale', 'Scale', 0.8, 0.1, 2),
      param.float('scaleRandom', 'Scale variation', 0.3, 0, 1),
      param.angle('rotation', 'Rotation', 0),
      param.float('rotationRandom', 'Rotation variation', 45, 0, 180, { unit: '°' }),
      param.float('lumRandom', 'Brightness variation', 0.3, 0, 1),
      param.select('combine', 'Combine', ['Max', 'Add'], 0),
      param.float('driftX', 'Drift X', 0, -4, 4, {
        group: 'Animation',
        description: 'Cells per second (the whole grid scrolls).',
      }),
      param.float('driftY', 'Drift Y', 0, -4, 4, { group: 'Animation' }),
      param.float('spin', 'Spin', 0, -360, 360, { group: 'Animation', unit: '°/s' }),
      param.float('spinRandom', 'Spin variation', 0, 0, 1, {
        group: 'Animation',
        description: 'Each copy spins at its own speed (some the other way).',
      }),
      param.float('animSpeed', 'Cycle speed', 0.5, 0, 4, {
        group: 'Animation',
        description: 'Cycles per second of wobble, pulse, twinkle and life cycle.',
      }),
      param.float('wobble', 'Wobble', 0, 0, 0.5, { group: 'Animation' }),
      param.float('pulse', 'Pulse', 0, 0, 1, { group: 'Animation' }),
      param.float('twinkle', 'Twinkle', 0, 0, 1, { group: 'Animation' }),
      param.float('lifecycle', 'Pop in / fade out', 0, 0, 1, { group: 'Animation' }),
    ],
    presets: [
      {
        name: 'Scattered',
        values: { count: 6, jitter: 0.6, scaleRandom: 0.4, rotationRandom: 180 },
      },
      {
        name: 'Neat grid',
        values: { count: 4, jitter: 0, scaleRandom: 0, rotationRandom: 0, lumRandom: 0 },
      },
      {
        name: 'Sparse confetti',
        values: { count: 10, density: 0.4, scale: 0.6, rotationRandom: 180 },
      },
      {
        name: 'Dense pile',
        values: { count: 8, scale: 1.6, scaleRandom: 0.5, rotationRandom: 180 },
      },
      {
        name: 'Sparkle field',
        values: { count: 8, density: 0.6, scale: 0.5, lifecycle: 1, twinkle: 0.5, animSpeed: 0.8 },
      },
      {
        name: 'Falling leaves',
        values: {
          count: 5,
          driftY: -0.5,
          spin: 90,
          spinRandom: 1,
          wobble: 0.2,
          rotationRandom: 180,
        },
      },
      {
        name: 'Floating motes',
        values: { count: 7, density: 0.7, scale: 0.4, driftY: 0.25, wobble: 0.3, pulse: 0.4 },
      },
    ],
  }),
  nativeLoop: () => true,
};

/** Spread passes until an island of this size shares one label (16 px per pass and side). */
const floodPasses = (width: number, height: number) =>
  Math.min(96, Math.ceil(Math.max(width, height) / 12) + 4);

export const floodFillOp = operator({
  id: 'op-flood-fill',
  name: 'Flood Fill',
  description:
    'Gives every island of a mask (bricks, plates, cells, shards) its own random value or ' +
    'color, or outputs the Data the "Flood Fill to…" nodes read (gradients, sizes, colors, ' +
    'patterns per island). Islands crossing the edges join.',
  fragment: floodFillFrag,
  passes: [
    {
      label: 'seed',
      fragment: floodSeedFrag,
      precise: true,
      repeat: (_v, _w, _h, inputs) => (inputs?.mask ? 1 : 0),
    },
    {
      label: 'spread',
      fragment: floodSpreadFrag,
      precise: true,
      repeat: (_v, w, h, inputs) => (inputs?.mask ? floodPasses(w, h) : 0),
    },
  ],
  inputs: [input('mask', 'Mask', 'Bright islands separated by dark lines.', '#6bb5ff', 'float')],
  params: [
    param.select(
      'output',
      'Output',
      ['Random gray', 'Random color', 'Data (for Flood Fill to…)'],
      0,
    ),
    param.float('minValue', 'Darkest', 0.2, 0, 1, { visibleWhen: (v) => Number(v.output) === 0 }),
    param.float('maxValue', 'Brightest', 1, 0, 1, { visibleWhen: (v) => Number(v.output) === 0 }),
    param.float('threshold', 'Threshold', 0.5, 0.01, 0.99, {
      description: 'Mask brightness above which a pixel belongs to an island.',
    }),
  ],
  presets: [
    { name: 'Gray per island', values: { output: 0 } },
    { name: 'Color per island', values: { output: 1 } },
    { name: 'Subtle variation', values: { output: 0, minValue: 0.6, maxValue: 0.9 } },
    { name: 'Data', values: { output: 2 } },
  ],
});

const FLOOD_DATA = input(
  'data',
  'Flood Fill',
  'The Data output of a Flood Fill node (Output: Data).',
  '#c58cff',
);

export const floodGradientOp = operator({
  id: 'op-flood-gradient',
  name: 'Flood Fill to Gradient',
  description:
    'A gradient across each island at a random angle and levels: tilted bricks, beveled ' +
    'plates, shading of shards. Reads a Flood Fill node set to Data.',
  fragment: `${floodCommon}\n${floodGradientFrag}`,
  inputs: [FLOOD_DATA],
  params: [
    param.angle('angle', 'Angle', 90),
    param.float('angleRandom', 'Angle variation', 180, 0, 180, { unit: '°' }),
    param.float('levelRandom', 'Level variation', 0.5, 0, 1),
  ],
  presets: [
    { name: 'Random tilt', values: { angleRandom: 180, levelRandom: 0.5 } },
    { name: 'Top lit', values: { angle: 90, angleRandom: 10, levelRandom: 0.2 } },
  ],
});

export const floodSizeOp = operator({
  id: 'op-flood-size',
  name: 'Flood Fill to Size',
  description:
    'Each island valued by its size: separate big and small pieces (Data from a Flood Fill).',
  fragment: `${floodCommon}\n${floodSizeFrag}`,
  inputs: [FLOOD_DATA],
  params: [
    param.select('mode', 'Measure', ['Largest side', 'Area'], 0),
    param.float('scale', 'Scale', 4, 0.1, 32),
    param.bool('invert', 'Invert', false),
  ],
  presets: [
    { name: 'Big bright', values: { scale: 4 } },
    { name: 'Small bright', values: { scale: 4, invert: true } },
  ],
});

export const floodColorOp = operator({
  id: 'op-flood-color',
  name: 'Flood Fill to Color',
  description:
    'Each island takes the color of an image at its center (mosaic, stained glass); random ' +
    'brightness per island. Reads a Flood Fill node set to Data.',
  fragment: `${floodCommon}\n${floodColorFrag}`,
  inputs: [FLOOD_DATA, input('image', 'Image', 'Colors sampled at island centers.', '#e8e8e8')],
  params: [
    param.float('lumRandom', 'Brightness variation', 0.2, 0, 1),
    param.bool('keepLines', 'Opaque lines', true, {
      description: 'Lines between islands black (off: transparent).',
    }),
  ],
  presets: [
    { name: 'Mosaic', values: { lumRandom: 0.2 } },
    { name: 'Stained glass', values: { lumRandom: 0.4, keepLines: true } },
  ],
});

export const floodMapperOp = operator({
  id: 'op-flood-mapper',
  name: 'Flood Fill Mapper',
  description:
    'Places a pattern in every island (fitted to its box) with random quarter turns, ' +
    'mirroring, offset and brightness: varied stone faces, planks, tiles.',
  fragment: `${floodCommon}\n${floodMapperFrag}`,
  inputs: [FLOOD_DATA, input('pattern', 'Pattern', 'Placed in each island.', '#e8e8e8')],
  params: [
    param.float('scale', 'Scale', 1, 0.1, 4),
    param.float('rotateRandom', 'Random turns', 0.5, 0, 1),
    param.float('mirrorRandom', 'Random mirror', 0.5, 0, 1),
    param.float('offsetRandom', 'Random offset', 0, 0, 1),
    param.float('lumRandom', 'Brightness variation', 0.3, 0, 1),
    param.bool('keepLines', 'Opaque lines', true),
  ],
  presets: [
    { name: 'Varied faces', values: { rotateRandom: 0.5, mirrorRandom: 0.5, lumRandom: 0.3 } },
    { name: 'Aligned', values: { rotateRandom: 0, mirrorRandom: 0, lumRandom: 0.15 } },
  ],
});

export const makeTileOp = operator({
  id: 'op-make-tile',
  name: 'Make It Tile',
  description:
    'Makes any image seamless: near the borders it crossfades with itself shifted by half a ' +
    'tile (best on organic images, e.g. an imported photo).',
  fragment: makeTileFrag,
  inputs: [IMAGE],
  params: [param.float('blend', 'Blend width', 0.3, 0.02, 1)],
  presets: [
    { name: 'Soft seams', values: { blend: 0.4 } },
    { name: 'Narrow seams', values: { blend: 0.12 } },
  ],
});

export const radialBlurOp = operator({
  id: 'op-radial-blur',
  name: 'Radial Blur',
  description: 'Zoom blur (streaks toward a center: god rays, impact rush) or spin blur around it.',
  fragment: radialBlurFrag,
  inputs: [IMAGE],
  params: [
    param.select('mode', 'Mode', ['Zoom', 'Spin'], 0),
    param.float('strength', 'Strength', 0.3, 0, 1),
    param.vec2('center', 'Center', [0.5, 0.5], 0, 1),
    param.bool('wrap', 'Wrap', false, { description: 'Sample across the edges (tiled images).' }),
  ],
  presets: [
    { name: 'God rays', values: { mode: 0, strength: 0.6 } },
    { name: 'Rush', values: { mode: 0, strength: 0.25 } },
    { name: 'Spin', values: { mode: 1, strength: 0.4 } },
  ],
});

export const polarOp = operator({
  id: 'op-polar',
  name: 'Polar Coordinates',
  description:
    'To polar: wraps the image around the center (stripes become rings, lines radiate). ' +
    'From polar: unrolls rings into stripes.',
  fragment: polarFrag,
  inputs: [IMAGE],
  params: [
    param.select('mode', 'Mode', ['To polar', 'From polar'], 0),
    param.int('repeat', 'Repeats', 1, 1, 16, { description: 'Copies around the circle.' }),
    param.float('radius', 'Radius', 1, 0.1, 2),
    param.float('twist', 'Twist', 0, -4, 4, { visibleWhen: (v) => Number(v.mode) === 0 }),
    param.bool('invert', 'Invert radius', false, {
      description: 'The image bottom goes to the rim instead of the center.',
    }),
  ],
  presets: [
    { name: 'Rings', values: { mode: 0, repeat: 1 } },
    { name: 'Radial burst', values: { mode: 0, repeat: 6, twist: 0 } },
    { name: 'Swirl', values: { mode: 0, repeat: 3, twist: 1.5 } },
    { name: 'Unroll', values: { mode: 1 } },
  ],
});

export const curvatureOp = operator({
  id: 'op-curvature',
  name: 'Curvature & Occlusion',
  description:
    'From a height map: curvature (bright convex edges for wear, dark cavities) or ambient ' +
    'occlusion (dark where the surroundings are higher, for dirt in crevices).',
  fragment: curvatureFrag,
  inputs: [input('height', 'Height', 'Bright = high.', '#6bb5ff', 'float')],
  params: [
    param.select('output', 'Output', ['Curvature', 'Occlusion'], 0),
    param.float('radius', 'Radius', 4, 0.5, 64, { unit: 'px' }),
    param.float('intensity', 'Intensity', 1, 0, 4),
  ],
  presets: [
    { name: 'Edge wear', values: { output: 0, radius: 3 } },
    { name: 'Crevice dirt', values: { output: 1, radius: 12 } },
    { name: 'Broad shading', values: { output: 1, radius: 40, intensity: 0.7 } },
  ],
});

export const heightBlendOp = operator({
  id: 'op-height-blend',
  name: 'Height Blend',
  description:
    'Mixes two materials by their heights: the highest wins with a soft transition (lava ' +
    'between stones, moss on bricks). Heights default to each image brightness.',
  fragment: heightBlendFrag,
  inputs: [
    input('a', 'A', 'First material.', '#e8e8e8'),
    input('b', 'B', 'Second material (raised by Offset).', '#e8e8e8'),
    input('heightA', 'Height A', 'Default: brightness of A.', '#6bb5ff', 'float'),
    input('heightB', 'Height B', 'Default: brightness of B.', '#6bb5ff', 'float'),
  ],
  params: [
    param.float('offset', 'Offset', 0, -1, 1, { description: 'Raises (or lowers) B.' }),
    param.float('contrast', 'Transition', 0.2, 0.01, 1),
    param.select('output', 'Output', ['Blend', 'Mask', 'Height'], 0),
  ],
  presets: [
    { name: 'Rising B', values: { offset: 0.1, contrast: 0.15 } },
    { name: 'Sharp', values: { contrast: 0.03 } },
    { name: 'Mask', values: { output: 1 } },
  ],
});

export const glowOp = operator({
  id: 'op-glow',
  name: 'Glow',
  description: 'Blooms the bright parts of an image (above the threshold) with a tinted halo.',
  fragment: glowFrag,
  inputs: [IMAGE],
  params: [
    param.float('threshold', 'Threshold', 0.6, 0, 1),
    param.float('radius', 'Radius', 24, 1, 128, { unit: 'px' }),
    param.float('intensity', 'Intensity', 1, 0, 4),
    param.color('tint', 'Tint', '#ffffff'),
  ],
  presets: [
    { name: 'Soft bloom', values: { threshold: 0.6, radius: 24 } },
    { name: 'Wide halo', values: { threshold: 0.4, radius: 80, intensity: 0.8 } },
    { name: 'Hot core', values: { threshold: 0.85, radius: 10, intensity: 2 } },
  ],
});

const stripInput = (n: number) => ({
  ...input(`s${n}`, `Strip ${n}`, `Strip ${n} (from the top).`, '#e8e8e8'),
  params: [`size${n}`],
});

export const trimSheetOp = operator({
  id: 'op-trim-sheet',
  name: 'Trim Sheet',
  description:
    'Stacks the connected nodes top-down as horizontal strips in one texture (sizes by ' +
    'weight). Repeat keeps texels square, so seamless inputs tile along the strips.',
  fragment: trimSheetFrag,
  inputs: [1, 2, 3, 4, 5, 6].map(stripInput),
  params: [
    param.select('mode', 'Fit', ['Repeat', 'Stretch'], 0),
    param.float('gutter', 'Gutter', 4, 0, 32, {
      unit: 'px',
      description: 'Between strips, filled with their edge rows (no bleeding in mipmaps).',
    }),
    ...[1, 2, 3, 4, 5, 6].map((n) =>
      param.float(`size${n}`, `Strip ${n} size`, 1, 0.1, 4, { group: 'Strip sizes' }),
    ),
  ],
});

/** Operators, most used first (the browser shows them in this order). */
export const OPERATORS: readonly ShaderGenerator[] = [
  outputOp,
  rerouteOp,
  blendOp,
  maskOp,
  manualLevelsOp,
  mathOp,
  transformOp,
  warpOp,
  tileSamplerOp,
  heightBlendOp,
  blurOp,
  glowOp,
  unpackOp,
  packOp,
  uniform,
  radialBlurOp,
  slopeBlurOp,
  autoLevelsOp,
  edgesOp,
  distanceOp,
  edgeFadeOp,
  curvatureOp,
  floodFillOp,
  floodGradientOp,
  floodSizeOp,
  floodColorOp,
  floodMapperOp,
  polarOp,
  makeTileOp,
  customOp,
  trimSheetOp,
  materialOutputOp,
  ...ANIMATION_OPERATORS,
];
