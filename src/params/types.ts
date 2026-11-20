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
}

export interface FloatParam extends ParamBase {
  readonly type: 'float';
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly default: number;
}

export interface IntParam extends ParamBase {
  readonly type: 'int';
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

export interface BoolParam extends ParamBase {
  readonly type: 'bool';
  readonly default: boolean;
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
}

/** Color ramp, exposed to GLSL as a 256x1 `sampler2D`. */
export interface GradientParam extends ParamBase {
  readonly type: 'gradient';
  readonly default: GradientValue;
}

export type ParamDef =
  | FloatParam
  | IntParam
  | BoolParam
  | ColorParam
  | SelectParam
  | Vec2Param
  | TextParam
  | GradientParam;

export type ParamType = ParamDef['type'];

/** A named set of parameter overrides (partial values). */
export interface Preset {
  readonly name: string;
  readonly values: ParamValues;
}
