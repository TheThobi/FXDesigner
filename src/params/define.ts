/**
 * Compact builders for parameter schemas, so generator definitions stay readable:
 *   param.float('scale', 'Scale', 4, 1, 32)
 */
import type { GradientValue } from './gradient';
import type {
  BoolParam,
  ColorParam,
  FloatParam,
  GradientParam,
  IntParam,
  SelectOption,
  SelectParam,
  TextParam,
  ImageParam,
  Vec2,
  Vec2Param,
} from './types';

type Extra = {
  group?: string;
  description?: string;
  resetOnChange?: boolean;
  visibleWhen?: (values: Readonly<Record<string, unknown>>) => boolean;
};

type NumberExtra = Extra & { unit?: string; limit?: readonly [number, number] };

export const param = {
  float: (
    key: string,
    label: string,
    def: number,
    min: number,
    max: number,
    extra: NumberExtra & { step?: number } = {},
  ): FloatParam => ({ type: 'float', key, label, default: def, min, max, ...extra }),

  int: (
    key: string,
    label: string,
    def: number,
    min: number,
    max: number,
    extra: NumberExtra = {},
  ): IntParam => ({
    type: 'int',
    key,
    label,
    default: def,
    min,
    max,
    ...extra,
  }),

  bool: (
    key: string,
    label: string,
    def: boolean,
    extra: Extra & Pick<BoolParam, 'invertedCheckbox'> = {},
  ): BoolParam => ({
    type: 'bool',
    key,
    label,
    default: def,
    ...extra,
  }),

  /** Module on/off switch shown in the header of `group`. */
  toggle: (key: string, group: string, def = false, description?: string): BoolParam => ({
    type: 'bool',
    key,
    label: `Enable ${group}`,
    default: def,
    group,
    toggle: true,
    ...(description ? { description } : {}),
  }),

  /** Angle in degrees. */
  angle: (key: string, label: string, def: number, extra: Extra = {}): FloatParam => ({
    type: 'float',
    key,
    label,
    default: def,
    min: 0,
    max: 360,
    unit: '°',
    ...extra,
  }),

  color: (key: string, label: string, def: string, extra: Extra = {}): ColorParam => ({
    type: 'color',
    key,
    label,
    default: def,
    ...extra,
  }),

  /** Options given as labels get values 0..n-1 in order. */
  select: (
    key: string,
    label: string,
    options: readonly (string | SelectOption)[],
    def = 0,
    extra: Extra = {},
  ): SelectParam => ({
    type: 'select',
    key,
    label,
    default: def,
    options: options.map((o, i) => (typeof o === 'string' ? { label: o, value: i } : o)),
    ...extra,
  }),

  vec2: (
    key: string,
    label: string,
    def: Vec2,
    min: number,
    max: number,
    extra: Extra & { step?: number } = {},
  ): Vec2Param => ({ type: 'vec2', key, label, default: def, min, max, ...extra }),

  /** Imported picture (data URL), empty by default. */
  image: (key: string, label: string, extra: Extra = {}): ImageParam => ({
    type: 'image',
    key,
    label,
    default: '',
    ...extra,
  }),

  text: (
    key: string,
    label: string,
    def: string,
    extra: Extra & { maxLength?: number; multiline?: boolean } = {},
  ): TextParam => ({
    type: 'text',
    key,
    label,
    default: def,
    ...extra,
  }),

  gradient: (key: string, label: string, def: GradientValue, extra: Extra = {}): GradientParam => ({
    type: 'gradient',
    key,
    label,
    default: def,
    ...extra,
  }),

  /** Simulation grid size (read by GridSimulation; restarts the simulation). */
  simResolution: (def = 256, sizes: readonly number[] = [128, 256, 512, 1024]): SelectParam => ({
    type: 'select',
    key: 'simResolution',
    label: 'Grid size',
    default: def,
    options: sizes.map((s) => ({ label: String(s), value: s })),
    group: 'Simulation',
    resetOnChange: true,
    description: 'Larger grids give finer detail (slower).',
  }),

  /** Simulation iterations per displayed frame. */
  stepsPerFrame: (def = 1, max = 64): IntParam => ({
    type: 'int',
    key: 'stepsPerFrame',
    label: 'Steps / frame',
    default: def,
    min: 1,
    max,
    group: 'Simulation',
  }),

  /** Radius of the interactive brush, in uv units. */
  brushSize: (def = 0.03): FloatParam => ({
    type: 'float',
    key: 'brushSize',
    label: 'Brush size',
    default: def,
    min: 0.005,
    max: 0.2,
    group: 'Simulation',
  }),

  /** Common "Animation speed" parameter. */
  speed: (def = 0.5, max = 4): FloatParam => ({
    type: 'float',
    key: 'speed',
    label: 'Speed',
    default: def,
    min: 0,
    max,
    group: 'Animation',
  }),
} as const;
