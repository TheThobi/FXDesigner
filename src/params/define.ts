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
  Vec2,
  Vec2Param,
} from './types';

type Extra = {
  group?: string;
  description?: string;
  resetOnChange?: boolean;
};

export const param = {
  float: (
    key: string,
    label: string,
    def: number,
    min: number,
    max: number,
    extra: Extra & { step?: number } = {},
  ): FloatParam => ({ type: 'float', key, label, default: def, min, max, ...extra }),

  int: (
    key: string,
    label: string,
    def: number,
    min: number,
    max: number,
    extra: Extra = {},
  ): IntParam => ({
    type: 'int',
    key,
    label,
    default: def,
    min,
    max,
    ...extra,
  }),

  bool: (key: string, label: string, def: boolean, extra: Extra = {}): BoolParam => ({
    type: 'bool',
    key,
    label,
    default: def,
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

  text: (
    key: string,
    label: string,
    def: string,
    extra: Extra & { maxLength?: number } = {},
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
