import type { GradientValue } from './gradient';

export type Vec2 = readonly [number, number];

/** Every value a parameter can hold. Must stay JSON-serializable (documents, URLs, presets). */
export type ParamValue = number | boolean | string | Vec2 | GradientValue;
export type ParamValues = Readonly<Record<string, ParamValue>>;

interface ParamBase {
  /** Identifier, also used as GLSL uniform name (`u_<key>`). Must be a valid identifier. */
  readonly key: string;
  readonly label: string;
  /** UI section; params without group land in "General". */
  readonly group?: string;
  /** Tooltip text. */
  readonly description?: string;
  /** For simulations: changing this value restarts the simulation. */
  readonly resetOnChange?: boolean;
  /** Shown only when this returns true for the current values (e.g. settings of one mode). */
  readonly visibleWhen?: (values: Readonly<Record<string, unknown>>) => boolean;
}

export interface FloatParam extends ParamBase {
  readonly type: 'float';
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly default: number;
  /** Suffix shown in the field (e.g. "°", "px"). */
  readonly unit?: string;
  /**
   * Range accepted when the value is typed (and in documents): the slider covers min..max,
   * typing may go further when it is safe. Default: `numericLimits` (wider above max).
   */
  readonly limit?: readonly [number, number];
}

export interface IntParam extends ParamBase {
  readonly type: 'int';
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly unit?: string;
  /**
   * Range accepted when the value is typed (and in documents): the slider covers min..max,
   * typing may go further when it is safe. Default: `numericLimits` (wider above max).
   */
  readonly limit?: readonly [number, number];
}

export interface BoolParam extends ParamBase {
  readonly type: 'bool';
  readonly default: boolean;
  /**
   * Module switch: rendered as the checkbox in its group's header; when off, the rest of the
   * group is collapsed and greyed out.
   */
  readonly toggle?: boolean;
}

/** `#rrggbb`, exposed to GLSL as `vec3`. */
export interface ColorParam extends ParamBase {
  readonly type: 'color';
  readonly default: string;
}

export interface SelectOption {
  readonly label: string;
  readonly value: number;
}

/** Enumeration, exposed to GLSL as `int`. */
export interface SelectParam extends ParamBase {
  readonly type: 'select';
  readonly options: readonly SelectOption[];
  readonly default: number;
}

export interface Vec2Param extends ParamBase {
  readonly type: 'vec2';
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly default: Vec2;
}

/** Free text; never sent to GLSL (used e.g. to rasterize seed text). */
export interface TextParam extends ParamBase {
  readonly type: 'text';
  readonly default: string;
  readonly maxLength?: number;
  /** Edited in a multi-line monospace box (e.g. GLSL code). */
  readonly multiline?: boolean;
}

/** Color ramp, exposed to GLSL as a 256x1 `sampler2D`. */
export interface GradientParam extends ParamBase {
  readonly type: 'gradient';
  readonly default: GradientValue;
}

/**
 * Imported picture, stored as a data URL (downscaled on import; '' = none). Exposed to GLSL as
 * `sampler2D u_<key>` plus `vec2 u_<key>Size` (pixels; 0 while loading / empty).
 */
export interface ImageParam extends ParamBase {
  readonly type: 'image';
  readonly default: string;
}

export type ParamDef =
  | FloatParam
  | IntParam
  | BoolParam
  | ColorParam
  | SelectParam
  | Vec2Param
  | TextParam
  | GradientParam
  | ImageParam;

export type ParamType = ParamDef['type'];

/** UI metadata for a parameter group ("module"). */
export interface ParamGroupInfo {
  readonly name: string;
  readonly description?: string;
  /** Icon name (see ui/icons) shown in the module header and chip. */
  readonly icon?: string;
  /** One-line state shown in the module header (e.g. "SSAA 2×2"). */
  readonly summary?: (values: ParamValues) => string;
}

/** A named set of parameter overrides (partial values), optionally with post overrides. */
export interface Preset {
  readonly name: string;
  readonly values: ParamValues;
  /** Overrides of the shared post-processing (e.g. posterize for a toon look). */
  readonly post?: ParamValues;
  /** Post Process color ramp set by the preset (otherwise the user's ramp is kept). */
  readonly ramp?: GradientValue;
}
