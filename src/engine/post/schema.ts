import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import type { ParamDef, ParamGroupInfo, ParamValues, Preset } from '../../params/types';

export const COLOR_MODE = { source: 0, gradient: 1 } as const;
export const ALPHA_MODE = { opaque: 0, luminance: 1, gradient: 2, source: 3 } as const;
export const OUTPUT_MODE = { color: 0, normal: 1, height: 2 } as const;
export const HEIGHT_SOURCE = { luminance: 0, alpha: 1 } as const;

/** Default shared color ramp: plain black → white, so generators show their raw values. */
export const DEFAULT_RAMP = GRADIENTS.linear;

/** Shared ramp (global state, edited in the Post Process tab's Color section). */
export const SHARED_RAMP_PARAM = param.gradient('ramp', 'Shared color ramp', DEFAULT_RAMP, {
  group: 'Color',
  description: 'Used by every generator in gradient-map mode, unless the generator overrides it.',
});

/** Per-generator override of the shared ramp (shown in the Generator tab). */
export const RAMP_OVERRIDE_PARAMS: readonly ParamDef[] = [
  param.toggle(
    'overrideRamp',
    'Color ramp override',
    false,
    'Use a ramp specific to this generator.',
  ),
  param.gradient('gradient', 'Ramp', DEFAULT_RAMP, { group: 'Color ramp override' }),
];

const n = (v: ParamValues, k: string) => Number(v[k] ?? 0);
const opt = (labels: readonly string[], v: ParamValues, k: string) => labels[n(v, k)] ?? '';

const SLOPE_SOURCES = ['Noise', 'Image luminance'] as const;
const SLOPE_MODES = ['Blur', 'Min', 'Max'] as const;
const PIXEL_MODES = ['Pixel art', 'Final image'] as const;
const OUTLINE_SIDES = ['Centered', 'Outside', 'Inside'] as const;
const PAPER_TYPES = ['Paper', 'Canvas', 'Fibers'] as const;

/**
 * Look development applied to every generator ("Post Process" tab), organised in modules
 * listed in pipeline order. Distances in "px" are relative to a 512 px texture, so preview and
 * export look identical at any resolution.
 */
export const POST_PROCESS_PARAMS: readonly ParamDef[] = [
  param.select('colorMode', 'Color mode', ['Source colors', 'Gradient map'], COLOR_MODE.gradient, {
    group: 'Color',
    description: 'Gradient map remaps luminance through the color ramp.',
  }),

  param.toggle('levelsOn', 'Levels'),
  param.float('brightness', 'Brightness', 0, -1, 1, { group: 'Levels' }),
  param.float('contrast', 'Contrast', 1, 0, 4, { group: 'Levels' }),
  param.float('gamma', 'Gamma', 1, 0.1, 4, { group: 'Levels' }),
  param.bool('invert', 'Invert', false, { group: 'Levels' }),

  param.toggle('slopeBlurOn', 'Slope blur'),
  param.select('slopeSource', 'Slope map', SLOPE_SOURCES, 0, { group: 'Slope blur' }),
  param.float('slopeScale', 'Noise scale', 4, 1, 32, { group: 'Slope blur' }),
  param.float('slopeIntensity', 'Intensity', 12, 0, 64, { group: 'Slope blur', unit: 'px' }),
  param.int('slopeSamples', 'Samples', 12, 2, 32, { group: 'Slope blur' }),
  param.select('slopeMode', 'Mode', SLOPE_MODES, 0, { group: 'Slope blur' }),

  param.toggle('kuwaharaOn', 'Kuwahara'),
  param.float('kuwaharaRadius', 'Radius', 4, 1, 16, { group: 'Kuwahara', unit: 'px' }),
  param.float('kuwaharaSharpness', 'Sharpness', 8, 1, 16, {
    group: 'Kuwahara',
    description: 'Higher = harder choice of the most uniform quadrant (crisper patches).',
  }),

  param.toggle('gradeOn', 'Color grade'),
  param.float('saturation', 'Saturation', 1, 0, 2, { group: 'Color grade' }),
  param.angle('hueShift', 'Hue shift', 0, { group: 'Color grade' }),
  param.float('temperature', 'Temperature', 0, -1, 1, {
    group: 'Color grade',
    description: 'Negative = cooler (blue), positive = warmer (orange).',
  }),
  param.float('shadowLift', 'Shadow tint', 0, 0, 1, {
    group: 'Color grade',
    description: 'Tints dark tones with the color below (painted shadows are rarely black).',
  }),
  param.color('shadowTint', 'Shadow color', '#2c1d4a', { group: 'Color grade' }),

  param.toggle('lightingOn', 'Relief lighting'),
  param.select(
    'lighting',
    'Style',
    [
      { label: 'Smooth', value: 1 },
      { label: 'Cel bands', value: 2 },
    ],
    1,
    {
      group: 'Relief lighting',
    },
  ),
  param.angle('lightAngle', 'Light angle', 125, { group: 'Relief lighting' }),
  param.float('lightElevation', 'Light elevation', 45, 5, 90, {
    group: 'Relief lighting',
    unit: '°',
  }),
  param.float('bumpStrength', 'Relief', 1, 0, 6, { group: 'Relief lighting' }),
  param.int('bands', 'Bands', 3, 2, 8, { group: 'Relief lighting' }),
  param.float('bandSoftness', 'Band softness', 0.25, 0, 1, { group: 'Relief lighting' }),
  param.color('shadowColor', 'Shadow tint', '#5a4f86', { group: 'Relief lighting' }),
  param.color('highlightColor', 'Light tint', '#fff1d6', { group: 'Relief lighting' }),
  param.float('cavity', 'Cavity darkening', 0.3, 0, 1, { group: 'Relief lighting' }),
  param.float('edgeHighlight', 'Edge highlight', 0.2, 0, 1, { group: 'Relief lighting' }),
  param.float('curvatureRadius', 'Curvature radius', 4, 1, 16, {
    group: 'Relief lighting',
    unit: 'px',
  }),

  param.toggle('watercolorOn', 'Watercolor'),
  param.float('wetEdges', 'Wet edges', 0.6, 0, 1, {
    group: 'Watercolor',
    description: 'Pigment pooling (darkening) along tone edges.',
  }),
  param.float('wetEdgeWidth', 'Edge width', 3, 1, 12, { group: 'Watercolor', unit: 'px' }),
  param.float('granulation', 'Granulation', 0.35, 0, 1, { group: 'Watercolor' }),
  param.float('bleed', 'Pigment variation', 0.3, 0, 1, {
    group: 'Watercolor',
    description: 'Low-frequency density variations, like uneven washes.',
  }),

  param.toggle('posterizeOn', 'Posterize'),
  param.int('posterize', 'Tones', 4, 2, 16, { group: 'Posterize' }),
  param.bool('dither', 'Dither', false, {
    group: 'Posterize',
    description: 'Ordered (Bayer) dithering.',
  }),

  param.toggle('halftoneOn', 'Halftone'),
  param.int('halftone', 'Cells', 48, 4, 160, { group: 'Halftone' }),
  param.angle('halftoneAngle', 'Angle', 45, { group: 'Halftone' }),

  param.toggle('pixelateOn', 'Pixelate'),
  param.int('pixelate', 'Blocks', 64, 4, 256, { group: 'Pixelate' }),
  param.select(
    'pixelMode',
    'Mode',
    ['Pixel art (effects follow pixels)', 'Pixelate final image'],
    0,
    {
      group: 'Pixelate',
      description:
        'Pixel art: outline, lighting and dithering work on the block grid (1-block outlines). ' +
        'Final image: everything is computed at full resolution, then pixelated.',
    },
  ),
  param.bool('pixelExport', 'Export at block resolution', false, {
    group: 'Pixelate',
    description: 'PNG / flipbook frames are exported with one pixel per block (e.g. 64×64).',
  }),

  param.toggle('paperOn', 'Paper grain'),
  param.float('paperAmount', 'Amount', 0.3, 0, 1, { group: 'Paper grain' }),
  param.float('paperScale', 'Scale', 8, 2, 32, { group: 'Paper grain' }),
  param.select('paperType', 'Texture', ['Cold-press paper', 'Canvas weave', 'Fibers'], 0, {
    group: 'Paper grain',
  }),

  param.toggle('outlineOn', 'Outline'),
  param.float('outline', 'Opacity', 1, 0, 1, { group: 'Outline' }),
  param.float('outlineWidth', 'Width', 1.5, 0.5, 8, { group: 'Outline', unit: 'px' }),
  param.select('outlineSide', 'Side', OUTLINE_SIDES, 1, { group: 'Outline' }),
  param.float('outlineThreshold', 'Edge threshold', 0.08, 0.01, 0.5, { group: 'Outline' }),
  param.color('outlineColor', 'Color', '#1a1420', { group: 'Outline' }),

  param.toggle('antialiasOn', 'Anti-aliasing'),
  param.select(
    'antialias',
    'Samples',
    [
      { label: 'SSAA 2×2', value: 1 },
      { label: 'SSAA 3×3', value: 2 },
      { label: 'SSAA 4×4', value: 3 },
    ],
    1,
    {
      group: 'Anti-aliasing',
      description: 'Supersampling: N×N samples per pixel (generator and post).',
    },
  ),
];

/** Header descriptions and live summaries of the Post Process modules. */
export const POST_MODULES: readonly ParamGroupInfo[] = [
  {
    name: 'Color',
    icon: 'palette',
    summary: (v) => (n(v, 'colorMode') === 1 ? 'Gradient map' : 'Source colors'),
  },
  {
    name: 'Levels',
    icon: 'levels',
    description: 'Brightness / contrast / gamma before any stylization.',
    summary: (v) =>
      `B ${n(v, 'brightness').toFixed(2)} · C ${n(v, 'contrast').toFixed(2)} · γ ${n(v, 'gamma').toFixed(2)}`,
  },
  {
    name: 'Slope blur',
    icon: 'brush',
    description:
      'Smears the image along the slopes of a noise (or of itself): painterly color smoothing.',
    summary: (v) => `${opt(SLOPE_MODES, v, 'slopeMode')} · ${n(v, 'slopeIntensity').toFixed(0)} px`,
  },
  {
    name: 'Kuwahara',
    icon: 'kuwahara',
    description: 'Edge-preserving smoothing into flat painterly patches (oil-paint look).',
    summary: (v) => `${n(v, 'kuwaharaRadius').toFixed(0)} px`,
  },
  {
    name: 'Color grade',
    icon: 'palette',
    description: 'Saturation, hue and temperature of the final colors; colored shadows.',
    summary: (v) =>
      `Sat ${n(v, 'saturation').toFixed(2)}${n(v, 'hueShift') ? ` · ${n(v, 'hueShift').toFixed(0)}°` : ''}`,
  },
  {
    name: 'Relief lighting',
    icon: 'sun',
    description: 'Lights the image as a relief (height from Output › Height source).',
    summary: (v) =>
      `${n(v, 'lighting') === 2 ? `${n(v, 'bands')} bands` : 'Smooth'} · ${n(v, 'lightAngle').toFixed(0)}°`,
  },
  {
    name: 'Watercolor',
    icon: 'drop',
    description: 'Darkened wet edges, pigment granulation and uneven washes.',
    summary: (v) =>
      `Edges ${n(v, 'wetEdges').toFixed(2)} · grain ${n(v, 'granulation').toFixed(2)}`,
  },
  {
    name: 'Posterize',
    icon: 'posterize',
    description: 'Flat tones; hue is kept in Source colors mode.',
    summary: (v) => `${n(v, 'posterize')} tones${v.dither ? ' · dither' : ''}`,
  },
  {
    name: 'Halftone',
    icon: 'halftone',
    description: 'Print-like dot grid.',
    summary: (v) => `${n(v, 'halftone')} cells`,
  },
  {
    name: 'Pixelate',
    icon: 'pixelate',
    description: 'Pixel blocks across the image.',
    summary: (v) =>
      `${n(v, 'pixelate')}² · ${opt(PIXEL_MODES, v, 'pixelMode')}${v.pixelExport ? ' · native export' : ''}`,
  },
  {
    name: 'Paper grain',
    icon: 'paper',
    description: 'Tileable paper / canvas texture multiplied over the image.',
    summary: (v) => `${opt(PAPER_TYPES, v, 'paperType')} · ${n(v, 'paperAmount').toFixed(2)}`,
  },
  {
    name: 'Outline',
    icon: 'outline',
    description: 'Ink lines on tone and alpha edges.',
    summary: (v) =>
      `${n(v, 'outlineWidth').toFixed(1)} px · ${opt(OUTLINE_SIDES, v, 'outlineSide')}`,
  },
  {
    name: 'Anti-aliasing',
    icon: 'antialias',
    description: 'Supersampling. Costly but clean edges.',
    summary: (v) => `SSAA ${n(v, 'antialias') + 1}×${n(v, 'antialias') + 1}`,
  },
];

/** Export-related settings ("Output" tab). Stored with the post values in documents. */
export const OUTPUT_PARAMS: readonly ParamDef[] = [
  param.select(
    'alphaMode',
    'Alpha',
    ['Opaque', 'From luminance', 'From color ramp', 'From source'],
    0,
    {
      group: 'Output',
      description: 'How the exported alpha channel is computed.',
    },
  ),
  param.select('output', 'Output map', ['Color', 'Normal map', 'Height map'], OUTPUT_MODE.color, {
    group: 'Output',
  }),
  param.select(
    'heightSource',
    'Height source',
    ['Luminance', 'Source alpha'],
    HEIGHT_SOURCE.luminance,
    {
      group: 'Output',
      description: 'Height used by relief lighting and normal / height maps.',
    },
  ),
  param.float('normalStrength', 'Normal strength', 2, 0, 10, { group: 'Output' }),
  param.bool('normalFlipY', 'Normal: DirectX (flip Y)', false, { group: 'Output' }),
];

/**
 * Animation loop of time-based generators (timeline + Output tab). The timeline spans
 * [0, loopDuration]; "seamless loop" forces the end to match the start (see shaderBuilder).
 */
export const TIME_PARAMS: readonly ParamDef[] = [
  param.float('loopDuration', 'Loop duration', 4, 0.5, 60, {
    group: 'Animation',
    unit: 's',
    step: 0.1,
    description: 'Length of the timeline; also the default flipbook duration.',
  }),
  param.bool('seamlessLoop', 'Force seamless loop', false, {
    group: 'Animation',
    description:
      'Crossfades the end of the loop into its start so any animation repeats without a jump. ' +
      'Can soften the effect during the blend.',
  }),
  param.float('loopBlend', 'Blend window', 0.5, 0.05, 1, {
    group: 'Animation',
    description: 'Fraction of the loop used for the crossfade (smaller = less ghosting).',
  }),
];

/** Every per-generator post value (all tabs), as persisted in documents. */
export const POST_PARAMS: readonly ParamDef[] = [
  ...POST_PROCESS_PARAMS,
  ...RAMP_OVERRIDE_PARAMS,
  ...OUTPUT_PARAMS,
  ...TIME_PARAMS,
];

/**
 * Look presets for the Post Process tab. Applied on top of the defaults (every module off), so
 * a preset fully defines the look; color mode and ramp are left alone.
 */
export const POST_PRESETS: readonly Preset[] = [
  { name: 'Clean (no effects)', values: {} },
  {
    name: 'Oil paint',
    values: {
      kuwaharaOn: true,
      kuwaharaRadius: 5,
      kuwaharaSharpness: 8,
      gradeOn: true,
      saturation: 1.15,
      shadowLift: 0.35,
      paperOn: true,
      paperType: 1,
      paperAmount: 0.25,
    },
  },
  {
    name: 'Painterly smear',
    values: {
      slopeBlurOn: true,
      slopeIntensity: 14,
      slopeScale: 5,
      kuwaharaOn: true,
      kuwaharaRadius: 3,
      gradeOn: true,
      shadowLift: 0.4,
    },
  },
  {
    name: 'Watercolor',
    values: {
      kuwaharaOn: true,
      kuwaharaRadius: 3,
      watercolorOn: true,
      wetEdges: 0.7,
      granulation: 0.45,
      bleed: 0.4,
      paperOn: true,
      paperAmount: 0.4,
      gradeOn: true,
      saturation: 0.85,
    },
  },
  {
    name: 'Gouache cel',
    values: {
      kuwaharaOn: true,
      kuwaharaRadius: 4,
      posterizeOn: true,
      posterize: 6,
      lightingOn: true,
      lighting: 2,
      bands: 3,
      bandSoftness: 0.35,
      outlineOn: true,
      outline: 0.6,
      outlineWidth: 1,
    },
  },
  {
    name: 'Ink & wash',
    values: {
      levelsOn: true,
      contrast: 1.3,
      watercolorOn: true,
      wetEdges: 0.9,
      granulation: 0.25,
      outlineOn: true,
      outlineWidth: 1.2,
      outlineSide: 0,
      paperOn: true,
      paperType: 2,
      paperAmount: 0.35,
    },
  },
  {
    name: 'Embossed relief',
    values: {
      lightingOn: true,
      lighting: 1,
      bumpStrength: 2,
      cavity: 0.6,
      edgeHighlight: 0.5,
    },
  },
  {
    name: 'Pixel art',
    values: {
      pixelateOn: true,
      pixelate: 64,
      pixelMode: 0,
      posterizeOn: true,
      posterize: 5,
      dither: true,
      outlineOn: true,
      outlineWidth: 1,
    },
  },
  {
    name: 'Retro print',
    values: {
      halftoneOn: true,
      halftone: 56,
      paperOn: true,
      paperAmount: 0.45,
      gradeOn: true,
      saturation: 0.8,
      temperature: 0.3,
    },
  },
  {
    name: 'Dreamy',
    values: {
      slopeBlurOn: true,
      slopeIntensity: 8,
      gradeOn: true,
      saturation: 1.25,
      hueShift: -12,
      temperature: -0.2,
      shadowLift: 0.6,
      shadowTint: '#3a2470',
    },
  },
];
