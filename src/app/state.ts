import type { GeneratorDefinition } from '../engine/generator';
import { inputsOf, outputsOf } from '../engine/nodes';
import { DEFAULT_RAMP, POST_PARAMS, POST_PROCESS_PARAMS } from '../engine/post/schema';
import { param } from '../params/define';
import type { GradientValue } from '../params/gradient';
import type { ParamDef, ParamValues } from '../params/types';
import { MAX_SEED } from '../util/random';
import { defaultValues, sanitizeValues } from '../params/values';

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
  /** Channel output of `from` (generators declaring `outputs`); absent = main output. */
  readonly output?: string;
}

/**
 * Editable state: the node graph shown in the viewport, the selected node (edited in the
 * Details panel, driven by the timeline, exported) and global settings.
 */
export interface EditorState {
  readonly nodes: readonly GraphNode[];
  readonly links: readonly GraphLink[];
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
  return {
    ...withNode(state, id, { generator: def.id, params: defaultValues(def.params), post }),
    links: state.links.filter(
      (l) => (l.to !== id || inputs.has(l.input)) && (l.from !== id || hasOutput(def, l.output)),
    ),
  };
}

/** Whether links from a `def` node may use `output` (main output when absent). */
export function hasOutput(def: GeneratorDefinition, output: string | undefined): boolean {
  const outputs = outputsOf(def);
  return output === undefined ? outputs.length === 0 : outputs.some((o) => o.key === output);
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
