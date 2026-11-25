import type { GeneratorDefinition } from '../engine/generator';
import { inputsOf, outputDef, outputsOf } from '../engine/nodes';
import { DEFAULT_RAMP, POST_PARAMS, POST_PROCESS_PARAMS } from '../engine/post/schema';
import { param } from '../params/define';
import type { GradientValue } from '../params/gradient';
import type { ParamDef, ParamType, ParamValue, ParamValues } from '../params/types';
import { MAX_SEED } from '../util/random';
import { clamp } from '../util/math';
import { RESERVED_UNIFORMS } from '../engine/shaderBuilder';
import { defaultValues, sanitizeValue, sanitizeValues } from '../params/values';

export const RESOLUTIONS = [128, 256, 512, 1024, 2048, 4096] as const;
export const DEFAULT_RESOLUTION = 512;
/** Workspace aspect ratios (width / height). */
export const ASPECTS = [1, 2, 0.5, 3, 1 / 3] as const;
/** Settings shared by every node, edited in the Output tab (stored as EditorState fields). */
export const GLOBAL_PARAMS: readonly ParamDef[] = [
  param.int('seed', 'Seed', 1, 0, MAX_SEED, {
    group: 'General',
    description: 'Random seed shared by generators and simulations.',
  }),
  param.select(
    'resolution',
    'Export resolution',
    RESOLUTIONS.map((r) => ({ label: `${r} × ${r}`, value: r })),
    DEFAULT_RESOLUTION,
    {
      group: 'General',
      description: 'PNG / flipbook export size (long side). The preview is capped at 1024.',
    },
  ),
  param.select(
    'aspect',
    'Workspace',
    [
      { label: 'Square 1:1', value: 1 },
      { label: 'Wide 2:1', value: 2 },
      { label: 'Tall 1:2', value: 0.5 },
      { label: 'Wide 3:1', value: 3 },
      { label: 'Tall 1:3', value: 1 / 3 },
    ],
    1,
    {
      group: 'General',
      description:
        'Image proportions for every node (e.g. tall for rising smoke). Patterns repeat along the ' +
        'long side; centered effects get more room. Simulations restart.',
    },
  ),
];

/** Pixel size of a `size` (long side) image in the `aspect` workspace. */
export function imageDims(size: number, aspect: number): [number, number] {
  return aspect >= 1
    ? [size, Math.max(1, Math.round(size / aspect))]
    : [Math.max(1, Math.round(size * aspect)), size];
}

/** The live preview never renders larger than this (exports use the full resolution). */
export const MAX_PREVIEW_SIZE = 1024;

/** One generator instance in the viewport graph. Plain JSON data (snapshotted for undo). */
export interface GraphNode {
  /** Unique within the document (persisted in links). */
  readonly id: string;
  /** Generator id. */
  readonly generator: string;
  /** Top-left corner in graph (world) units. */
  readonly x: number;
  readonly y: number;
  readonly params: ParamValues;
  /** Optional seed for this node. Otherwise it follows the workspace seed. */
  readonly seed?: number;
  /** This node's Post Process values (every node has its own look). */
  readonly post: ParamValues;
  /** Color ramp of the post pass (gradient-map mode). */
  readonly ramp: GradientValue;
  /** Post Process bypass: when false the node outputs its raw source. */
  readonly postEnabled: boolean;
  /** Freeze frame: the time the node is frozen at (null = live). Frozen sims stop stepping. */
  readonly frozenAt: number | null;
  /** Collapsed in the graph (header and pins only, no image). Absent = expanded. */
  readonly collapsed?: boolean;
  /**
   * GLSL replacing the generator's main fragment (shader generators): the node was converted
   * to code and edited, it is a custom node. Absent = the generator's own code.
   */
  readonly code?: string;
  /** Parameters created in the Code view (custom nodes): sliders exposed as uniforms. */
  readonly customParams?: readonly CustomParamSpec[];
  /** Per-node edits to generator parameters. Null removes a parameter and its uniform. */
  readonly baseParamEdits?: Readonly<Record<string, BaseParamEdit | null>>;
}

export interface BaseParamEdit {
  readonly label: string;
  readonly type: ParamType;
  readonly group: string;
  readonly default: ParamValue;
  readonly min?: number;
  readonly max?: number;
}

/** A parameter made by the user for a custom node (like a material parameter in Unreal). */
export interface CustomParamSpec {
  /** Uniform `u_<key>`. */
  readonly key: string;
  readonly label: string;
  readonly type: 'float' | 'int' | 'bool' | 'color';
  readonly min: number;
  readonly max: number;
  readonly default: number | boolean | string;
  /** Section of the panel ("General" when empty). */
  readonly group: string;
}

export const MAX_CUSTOM_PARAMS = 32;
const CUSTOM_KEY_RE = /^[a-z][A-Za-z0-9]{0,23}$/;
const RESERVED: ReadonlySet<string> = new Set(RESERVED_UNIFORMS);

/** A uniform-safe key from a label ("Glow size" → glowSize), unique among `taken`. */
export function customParamKey(label: string, taken: ReadonlySet<string>): string {
  const words = label
    .normalize('NFD')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let key = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
    .replace(/^[^a-z]+/, '')
    .slice(0, 20);
  if (!key) key = 'param';
  let unique = key;
  for (let i = 2; taken.has(unique) || RESERVED.has(`u_${unique}`); i++) unique = `${key}${i}`;
  return unique;
}

/** ParamDefs of custom parameters (shown and sanitized like the generator's own). */
export function customParamDefs(specs: readonly CustomParamSpec[]): ParamDef[] {
  return specs.map((s) => {
    const extra = { group: s.group || 'Custom' };
    switch (s.type) {
      case 'bool':
        return param.bool(s.key, s.label, s.default === true, extra);
      case 'color':
        return param.color(
          s.key,
          s.label,
          typeof s.default === 'string' ? s.default : '#ffffff',
          extra,
        );
      case 'int':
        return param.int(
          s.key,
          s.label,
          Math.round(Number(s.default) || 0),
          Math.round(s.min),
          Math.round(s.max),
          extra,
        );
      default:
        return param.float(s.key, s.label, Number(s.default) || 0, s.min, s.max, extra);
    }
  });
}

/** Validated custom parameters (untrusted documents): keys unique and not taken by `def`. */
export function sanitizeCustomParams(raw: unknown, taken: ReadonlySet<string>): CustomParamSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomParamSpec[] = [];
  const keys = new Set(taken);
  for (const r of raw.slice(0, MAX_CUSTOM_PARAMS)) {
    const o = (typeof r === 'object' && r !== null ? r : {}) as Record<string, unknown>;
    const key = typeof o.key === 'string' ? o.key : '';
    if (!CUSTOM_KEY_RE.test(key) || keys.has(key) || RESERVED.has(`u_${key}`)) continue;
    const type = ['float', 'int', 'bool', 'color'].includes(o.type as string)
      ? (o.type as CustomParamSpec['type'])
      : 'float';
    const num = (v: unknown, f: number) => (typeof v === 'number' && Number.isFinite(v) ? v : f);
    let min = num(o.min, 0);
    let max = num(o.max, 1);
    if (max <= min) [min, max] = [Math.min(min, max), Math.max(min, max) + 1];
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim().slice(0, 40) : key;
    const group = typeof o.group === 'string' ? o.group.trim().slice(0, 40) : '';
    const fallback = type === 'bool' ? false : type === 'color' ? '#ffffff' : min;
    const def =
      type === 'bool'
        ? o.default === true
        : type === 'color'
          ? typeof o.default === 'string' && /^#[0-9a-f]{6}$/i.test(o.default)
            ? o.default
            : fallback
          : Math.min(max, Math.max(min, num(o.default, min)));
    keys.add(key);
    out.push({ key, label, type, min, max, default: def, group });
  }
  return out;
}

/** Applies a node's edits to its generator's parameters, keeping their original order. */
export function editedBaseParams(
  defs: readonly ParamDef[],
  edits: GraphNode['baseParamEdits'],
): ParamDef[] {
  return defs.flatMap((def) => {
    const edit = edits?.[def.key];
    if (edit === null) return [];
    if (!edit) return [def];
    if (edit.type !== def.type) {
      const specs = sanitizeCustomParams([{ ...edit, key: def.key }], new Set());
      return specs.length ? customParamDefs(specs) : [def];
    }
    const updated = { ...def, label: edit.label, group: edit.group };
    if ('min' in updated && edit.min !== undefined && edit.max !== undefined)
      Object.assign(updated, { min: edit.min, max: edit.max });
    return [{ ...updated, default: sanitizeValue(updated, edit.default) } as ParamDef];
  });
}

export function sanitizeBaseParamEdits(
  raw: unknown,
  defs: readonly ParamDef[],
): Record<string, BaseParamEdit | null> {
  const out: Record<string, BaseParamEdit | null> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const edits = raw as Record<string, unknown>;
  for (const def of defs) {
    if (!Object.hasOwn(edits, def.key)) continue;
    const value = edits[def.key];
    if (value === null) {
      out[def.key] = null;
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    const edit = value as Partial<BaseParamEdit>;
    const label =
      typeof edit.label === 'string' ? edit.label.trim().slice(0, 40) || def.label : def.label;
    const group =
      typeof edit.group === 'string' ? edit.group.trim().slice(0, 40) : (def.group ?? '');
    if (
      edit.type !== def.type &&
      (edit.type === 'float' ||
        edit.type === 'int' ||
        edit.type === 'bool' ||
        edit.type === 'color')
    ) {
      const spec = sanitizeCustomParams([{ ...edit, key: def.key, label, group }], new Set())[0];
      if (spec) {
        const { key: _key, ...rest } = spec;
        out[def.key] = rest;
        continue;
      }
    }
    let shape: ParamDef = def;
    let range = {};
    if ('min' in def) {
      const bound = (value: number | undefined, fallback: number) =>
        typeof value === 'number' && Number.isFinite(value)
          ? def.type === 'int'
            ? Math.round(value)
            : value
          : fallback;
      const step = def.type === 'int' ? 1 : 0.000001;
      const [lower, upper] = 'limit' in def && def.limit ? def.limit : [-1e9, 1e9];
      const min = clamp(bound(edit.min, def.min), lower, Math.max(lower, upper - step));
      const max = clamp(bound(edit.max, def.max), Math.min(upper, min + step), upper);
      range = { min, max };
      shape = { ...def, ...range };
    }
    out[def.key] = {
      label,
      group,
      type: def.type,
      default: sanitizeValue(shape, edit.default),
      ...range,
    };
  }
  return out;
}

/** The generator a node runs, with its edited and custom parameters. */
export function effectiveGenerator(
  def: GeneratorDefinition,
  node: Pick<GraphNode, 'baseParamEdits' | 'customParams'>,
): GeneratorDefinition {
  if (def.kind !== 'shader' || (!node.baseParamEdits && !node.customParams?.length)) return def;
  return {
    ...def,
    params: [
      ...editedBaseParams(def.params, node.baseParamEdits),
      ...customParamDefs(node.customParams ?? []),
    ],
  };
}

/** Longest custom code kept in documents (characters). */
export const MAX_NODE_CODE = 65536;

/** Whether `code` differs from `original` (line endings and outer whitespace ignored). */
export function codeDiffers(code: string, original: string): boolean {
  const norm = (s: string) => s.replace(/\r\n?/g, '\n').trim();
  return norm(code) !== norm(original);
}

/** Output of `from` feeds input `input` of `to`. One link per (to, input). */
export interface GraphLink {
  readonly from: string;
  readonly to: string;
  readonly input: string;
  /** Output of `from`: a declared channel output, or a standard one (rgb, r, g, b, a); absent = main RGBA. */
  readonly output?: string;
}

/**
 * Editable state: the node graph shown in the viewport, the selected node (edited in the
 * Details panel, driven by the timeline, exported) and global settings.
 */
/** A titled, colored box behind nodes of the graph (organization only, no effect on images). */
export interface GraphFrame {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly title: string;
  /** Index into FRAME_COLORS. */
  readonly color: number;
}

/** Frame tints (muted, the UI stays neutral). */
export const FRAME_COLORS: readonly { readonly name: string; readonly value: string }[] = [
  { name: 'Slate', value: '#5b6b7f' },
  { name: 'Violet', value: '#7a5b8f' },
  { name: 'Green', value: '#4f7f6a' },
  { name: 'Amber', value: '#8a6a3f' },
  { name: 'Red', value: '#8a4f4f' },
];

export const MAX_FRAMES = 64;
export const MIN_FRAME_SIZE = 120;

/** Validates untrusted frames (documents, storage): finite boxes, short titles, known colors. */
export function sanitizeFrames(raw: unknown): GraphFrame[] {
  if (!Array.isArray(raw)) return [];
  const out: GraphFrame[] = [];
  for (const r of raw.slice(0, MAX_FRAMES)) {
    if (typeof r !== 'object' || r === null) continue;
    const o = r as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
    const [x, y, w, h] = [num(o.x), num(o.y), num(o.w), num(o.h)];
    if (typeof o.id !== 'string' || ![x, y, w, h].every(Number.isFinite)) continue;
    if (out.some((f) => f.id === o.id)) continue;
    out.push({
      id: o.id.slice(0, 32),
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(Math.min(20000, Math.max(MIN_FRAME_SIZE, w))),
      h: Math.round(Math.min(20000, Math.max(MIN_FRAME_SIZE, h))),
      title: typeof o.title === 'string' ? o.title.slice(0, 64) : '',
      color: Math.min(FRAME_COLORS.length - 1, Math.max(0, Math.round(num(o.color)) || 0)),
    });
  }
  return out;
}

export interface EditorState {
  readonly nodes: readonly GraphNode[];
  readonly links: readonly GraphLink[];
  /** Comment frames of the graph (absent = none). */
  readonly frames?: readonly GraphFrame[];
  readonly selectedId: string;
  readonly resolution: number;
  readonly seed: number;
  /** Workspace aspect ratio (width / height), one of ASPECTS. */
  readonly aspect: number;
}

/**
 * The Post Process look modules (every Post Process param except color mode): what a look
 * preset resets, and what a node keeps when its generator is swapped.
 */
export const SCOPED_POST_PARAMS: readonly ParamDef[] = POST_PROCESS_PARAMS.filter(
  (d) => d.key !== 'colorMode',
);
const SCOPED_KEYS = new Set(SCOPED_POST_PARAMS.map((d) => d.key));

export function pickScoped(values: ParamValues): ParamValues {
  return Object.fromEntries(Object.entries(values).filter(([k]) => SCOPED_KEYS.has(k)));
}

export function postDefaults(def: GeneratorDefinition): ParamValues {
  return sanitizeValues(POST_PARAMS, def.defaultPost ?? {}, defaultValues(POST_PARAMS));
}

export function createNode(
  def: GeneratorDefinition,
  id: string,
  x: number,
  y: number,
  ramp: GradientValue = DEFAULT_RAMP,
): GraphNode {
  return {
    id,
    generator: def.id,
    x,
    y,
    params: defaultValues(def.params),
    post: postDefaults(def),
    ramp,
    postEnabled: true,
    frozenAt: null,
    ...(def.startCollapsed ? { collapsed: true } : {}),
  };
}

/** A fresh id not used by any node of `state`. */
export function newNodeId(nodes: readonly GraphNode[]): string {
  let max = 0;
  for (const n of nodes) {
    const m = /^n(\d+)$/.exec(n.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `n${max + 1}`;
}

export function nodeById(state: EditorState, id: string): GraphNode | undefined {
  return state.nodes.find((n) => n.id === id);
}

export function selectedNode(state: EditorState): GraphNode {
  return nodeById(state, state.selectedId) ?? state.nodes[0]!;
}

export function withNode(
  state: EditorState,
  id: string,
  patch: Partial<Omit<GraphNode, 'id'>>,
): EditorState {
  return { ...state, nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
}

export function withAddedNode(state: EditorState, node: GraphNode): EditorState {
  return { ...state, nodes: [...state.nodes, node], selectedId: node.id };
}

/** Removes a node and its links (the last node can't be removed). */
export function withoutNode(state: EditorState, id: string): EditorState {
  if (state.nodes.length <= 1 || !nodeById(state, id)) return state;
  const nodes = state.nodes.filter((n) => n.id !== id);
  return {
    ...state,
    nodes,
    links: state.links.filter((l) => l.from !== id && l.to !== id),
    selectedId: state.selectedId === id ? nodes[nodes.length - 1]!.id : state.selectedId,
  };
}

/**
 * Swaps a node's generator. Parameters restart from the new generator's defaults; the Post
 * Process look and ramp are kept (data generators such as flowmaps get their own defaults).
 * Links into inputs / out of outputs the new generator doesn't have are dropped.
 */
export function withNodeGenerator(
  state: EditorState,
  id: string,
  def: GeneratorDefinition,
  previous: GeneratorDefinition | undefined,
): EditorState {
  const node = nodeById(state, id);
  if (!node) return state;
  const keepLook = !def.dataOutput && !previous?.dataOutput;
  const post = keepLook ? { ...postDefaults(def), ...pickScoped(node.post) } : postDefaults(def);
  const inputs = new Set(inputsOf(def).map((i) => i.key));
  // Custom code and parameters belong to the previous generator.
  const { code: _code, customParams: _custom, baseParamEdits: _edits, ...rest } = node;
  const swapped: GraphNode = {
    ...rest,
    generator: def.id,
    params: defaultValues(def.params),
    post,
  };
  return {
    ...state,
    nodes: state.nodes.map((n) => (n.id === id ? swapped : n)),
    links: state.links.filter(
      (l) => (l.to !== id || inputs.has(l.input)) && (l.from !== id || hasOutput(def, l.output)),
    ),
  };
}

/** Whether links from a `def` node may use `output` (main output when absent). */
export function hasOutput(def: GeneratorDefinition, output: string | undefined): boolean {
  if (output === undefined) return outputsOf(def).length === 0;
  return outputDef(def, output) !== undefined;
}

/** True when `from` is `to` or depends on it (linking from → to would create a cycle). */
export function dependsOn(links: readonly GraphLink[], from: string, to: string): boolean {
  if (from === to) return true;
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const l of links) if (l.to === id) stack.push(l.from);
  }
  return false;
}

/** Connects `link`, replacing any link into the same input. Refuses cycles (returns state). */
export function withLink(state: EditorState, link: GraphLink): EditorState {
  if (!nodeById(state, link.from) || !nodeById(state, link.to)) return state;
  if (dependsOn(state.links, link.from, link.to)) return state;
  const others = state.links.filter((l) => !(l.to === link.to && l.input === link.input));
  return { ...state, links: [...others, link] };
}

export function withoutLink(state: EditorState, to: string, input: string): EditorState {
  return { ...state, links: state.links.filter((l) => !(l.to === to && l.input === input)) };
}

/** Input key → the link feeding it, for node `id`. */
export function inputLinks(links: readonly GraphLink[], id: string): Record<string, GraphLink> {
  const out: Record<string, GraphLink> = {};
  for (const l of links) if (l.to === id) out[l.input] = l;
  return out;
}

/** Nodes `id` depends on (transitively) followed by `id` itself, in evaluation order. */
export function evaluationOrder(state: EditorState, id: string): GraphNode[] {
  const order: GraphNode[] = [];
  const visited = new Set<string>();
  const visit = (nid: string) => {
    if (visited.has(nid)) return;
    visited.add(nid);
    for (const l of state.links) if (l.to === nid) visit(l.from);
    const node = nodeById(state, nid);
    if (node) order.push(node);
  };
  visit(id);
  return order;
}

/** Every node, upstream before downstream. */
export function fullEvaluationOrder(state: EditorState): GraphNode[] {
  const order: GraphNode[] = [];
  const seen = new Set<string>();
  for (const n of state.nodes) {
    for (const m of evaluationOrder(state, n.id)) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        order.push(m);
      }
    }
  }
  return order;
}

export function nearestResolution(size: number): number {
  let best: number = DEFAULT_RESOLUTION;
  for (const r of RESOLUTIONS) if (Math.abs(r - size) < Math.abs(best - size)) best = r;
  return best;
}
