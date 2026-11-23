/**
 * Portable, versioned description of a texture graph. Used for .json files, share links and
 * autosave. When the shape changes: bump DOCUMENT_VERSION and add a step to `migrate()` so
 * older files and links keep working.
 */
import type { GeneratorDefinition } from '../engine/generator';
import { inputsOf } from '../engine/nodes';
import { upgradeLegacyPost } from '../engine/post/legacy';
import { DEFAULT_RAMP, POST_PARAMS } from '../engine/post/schema';
import { sanitizeGradient } from '../params/gradient';
import { sanitizeValues } from '../params/values';
import { decodeBase64Url, encodeBase64Url } from '../util/base64';
import { MAX_SEED } from '../util/random';
import { clamp } from '../util/math';
import {
  ASPECTS,
  dependsOn,
  hasOutput,
  MAX_NODE_CODE,
  effectiveGenerator,
  sanitizeBaseParamEdits,
  sanitizeCustomParams,
  nearestResolution,
  postDefaults,
  type EditorState,
  type GraphLink,
  type GraphNode,
} from './state';

export const DOCUMENT_FORMAT = 'fx-designer';
/** Format id of documents saved before the FX Designer rename (still accepted). */
const LEGACY_FORMATS: readonly string[] = ['procedural-texture-maker'];
export const DOCUMENT_VERSION = 8;

export interface TextureDocument {
  readonly format: typeof DOCUMENT_FORMAT;
  readonly version: typeof DOCUMENT_VERSION;
  readonly nodes: readonly GraphNode[];
  readonly links: readonly GraphLink[];
  /** Selected node (shown in the Details panel, exported). */
  readonly selected: string;
  readonly resolution: number;
  readonly seed: number;
  /** Workspace aspect (width / height); optional in files (default 1). */
  readonly aspect: number;
}

export class DocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentError';
  }
}

export type GeneratorLookup = (id: string) => GeneratorDefinition | undefined;

export function documentFromState(state: EditorState, lookup: GeneratorLookup): TextureDocument {
  return {
    format: DOCUMENT_FORMAT,
    version: DOCUMENT_VERSION,
    // Re-validated so values saved before a schema change (new param) are completed.
    nodes: state.nodes.map((n) => sanitizeNode(n, lookup)).filter((n) => n !== null),
    links: state.links,
    selected: state.selectedId,
    resolution: state.resolution,
    seed: state.seed,
    aspect: state.aspect,
  };
}

/** The document replaces the whole graph. */
export function applyDocument(doc: TextureDocument): EditorState {
  return {
    nodes: doc.nodes,
    links: doc.links,
    selectedId: doc.selected,
    resolution: doc.resolution,
    seed: doc.seed,
    aspect: doc.aspect,
  };
}

/** Upgrades raw documents from older versions to the current shape. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const version = raw.version;
  if (version === DOCUMENT_VERSION) return raw;
  if (typeof version !== 'number' || version > DOCUMENT_VERSION) {
    throw new DocumentError(`Unsupported document version: ${String(version)}`);
  }
  let data = raw;
  if (data.version === 1) data = migrateV1toV2(data);
  if (data.version === 2) data = migrateV2toV3(data);
  if (data.version === 3) data = migrateV3toV4(data);
  if (data.version === 4) data = migrateV4toV5(data);
  if (data.version === 5) data = migrateV5toV6(data);
  if (data.version === 6) data = migrateV6toV7(data);
  if (data.version === 7) data = migrateV7toV8(data);
  return data;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/**
 * v1 -> v2: post-processing became on/off modules and the color ramp became shared.
 * A v1 per-generator gradient is kept as a ramp override so the look is preserved.
 */
function migrateV1toV2(raw: Record<string, unknown>): Record<string, unknown> {
  const post = upgradeLegacyPost(record(raw.post));
  if (post.gradient !== undefined) post.overrideRamp = true;
  return { ...raw, version: 2, post };
}

/** v2 -> v3: the per-generator ramp override was removed; an active one becomes the ramp. */
function migrateV2toV3(raw: Record<string, unknown>): Record<string, unknown> {
  const { overrideRamp, gradient, ...post } = record(raw.post);
  const override = overrideRamp === true ? sanitizeGradient(gradient) : null;
  return { ...raw, version: 3, post, ramp: override ?? raw.ramp };
}

/** v3 -> v4: the single generator became a node graph; the document is its only node. */
function migrateV3toV4(raw: Record<string, unknown>): Record<string, unknown> {
  const node = {
    id: 'n1',
    generator: raw.generator,
    x: 0,
    y: 0,
    params: raw.params,
    post: raw.post,
    ramp: raw.ramp,
    postEnabled: true,
  };
  return {
    format: raw.format,
    version: 4,
    nodes: [node],
    links: [],
    selected: 'n1',
    resolution: raw.resolution,
    seed: raw.seed,
  };
}

/** v4 blend modes (generic Base input) -> Blend operator modes. */
const V4_BLEND_MODES = [0, 1, 3, 4, 5, 6, 7, 2];

interface MigratedOp {
  readonly id: string;
  readonly generator: string;
  readonly params: Record<string, unknown>;
  /** Main input (fed by the previous step of the chain). */
  readonly main: string;
  /** Other inputs: input key -> source node id (resolved to its chain end later). */
  readonly inputs: Record<string, string>;
}

/** Operators replacing one v4 node's adjustments and generic inputs, in pipeline order. */
function v4Operators(
  node: Record<string, unknown>,
  links: readonly Record<string, unknown>[],
  newId: () => string,
): MigratedOp[] {
  const io = record(node.io);
  const adjust = record(node.adjust);
  const linkInto = (input: string) => {
    const from = links.find((l) => l.to === node.id && l.input === input)?.from;
    return typeof from === 'string' ? from : undefined;
  };
  const ops: MigratedOp[] = [];
  const add = (generator: string, params: Record<string, unknown>, inputs = {}, main = 'image') =>
    ops.push({ id: newId(), generator, params, main, inputs });
  if (adjust.transformOn === true) {
    add('op-transform', {
      tile: adjust.tile,
      rotation: Number(adjust.turn ?? 0) * 90,
      flipX: adjust.flipX,
      flipY: adjust.flipY,
      offset: adjust.offset,
    });
  }
  if (adjust.mathOn === true) {
    add('op-levels', {
      power: adjust.power,
      gain: adjust.gain,
      bias: adjust.bias,
      fold: adjust.fold,
      threshold: adjust.threshold,
      softness: adjust.thresholdSoftness,
      invert: adjust.invertValue,
      clampValue: adjust.clampValue,
    });
  }
  if (adjust.codeOn === true && typeof adjust.code === 'string') {
    add('op-custom', { code: adjust.code.replaceAll('sampleSource(', 'a(') }, {}, 'a');
  }
  const warp = linkInto('warp');
  if (warp !== undefined) {
    // v4 measured slopes over 1/64 of the image, the Warp operator over 1/128.
    add('op-warp', { mode: 0, intensity: Number(io.warpAmount ?? 0.15) * 2 }, { warp });
  }
  const base = linkInto('base');
  const mask = linkInto('mask');
  if (base !== undefined) {
    const params = {
      mode: V4_BLEND_MODES[Number(io.blendMode ?? 0)] ?? 0,
      opacity: io.blendOpacity,
      invertMask: io.maskInvert,
    };
    add(
      'op-blend',
      params,
      mask !== undefined ? { background: base, mask } : { background: base },
      'foreground',
    );
  } else if (mask !== undefined) {
    add('op-mask', { invert: io.maskInvert }, { mask });
  }
  return ops;
}

/**
 * v4 -> v5: generic node inputs (Base / Mask / Warp) and Generator-tab adjustments became
 * operator nodes. Each node's adjustments (Transform, Math, Custom code), then its Warp, then
 * its Base blend (with its Mask) or its Mask alone become a chain of operators to its right.
 * Everything that read the node (generic inputs of other nodes, other links) now reads the end
 * of its chain, as the v4 output included those steps.
 */
function migrateV4toV5(raw: Record<string, unknown>): Record<string, unknown> {
  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : []).map(record);
  const links = (Array.isArray(raw.links) ? raw.links : []).map(record);
  const ids = new Set(nodes.map((n) => String(n.id)));
  let next = 1;
  const newId = () => {
    while (ids.has(`n${next}`)) next++;
    ids.add(`n${next}`);
    return `n${next}`;
  };
  // Pass 1: every node's operator chain, and where its final image now comes from.
  const chains = new Map<string, MigratedOp[]>();
  const end = new Map<string, string>();
  for (const node of nodes) {
    const ops = v4Operators(node, links, newId);
    chains.set(String(node.id), ops);
    end.set(String(node.id), ops.at(-1)?.id ?? String(node.id));
  }
  const output = (id: unknown) => end.get(String(id)) ?? String(id);
  // Pass 2: nodes, chain links, and the remaining (non-generic) links from chain ends.
  const outNodes: Record<string, unknown>[] = [];
  const outLinks: Record<string, unknown>[] = [];
  for (const node of nodes) {
    // v4-only fields (io, adjust) are dropped: their effects now live in the operators.
    outNodes.push(
      Object.fromEntries(Object.entries(node).filter(([k]) => k !== 'io' && k !== 'adjust')),
    );
    const x = typeof node.x === 'number' ? node.x : 0;
    const y = typeof node.y === 'number' ? node.y : 0;
    let prev = String(node.id);
    chains.get(String(node.id))!.forEach((op, i) => {
      outNodes.push({
        id: op.id,
        generator: op.generator,
        x: x + 420 * (i + 1),
        y,
        params: op.params,
      });
      outLinks.push({ from: prev, to: op.id, input: op.main });
      for (const [input, from] of Object.entries(op.inputs))
        outLinks.push({ from: output(from), to: op.id, input });
      prev = op.id;
    });
  }
  for (const l of links) {
    if (['base', 'mask', 'warp'].includes(String(l.input))) continue;
    outLinks.push({ ...l, from: output(l.from) });
  }
  return { ...raw, version: 5, nodes: outNodes, links: outLinks };
}

/**
 * v5 -> v6: links may name a channel output. The Channels operator became Unpack RGBA (four
 * outputs): links from it now leave the chosen channel's output; its Luminance mode becomes a
 * Custom Code node.
 */
function migrateV5toV6(raw: Record<string, unknown>): Record<string, unknown> {
  const CHANNEL_OUTPUTS = ['r', 'g', 'b', 'a'];
  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : []).map(record);
  const channelOf = new Map<string, number>();
  const outNodes = nodes.map((node) => {
    if (node.generator !== 'op-channels') return node;
    const params = record(node.params);
    const channel = typeof params.channel === 'number' ? Math.round(params.channel) : 4;
    channelOf.set(String(node.id), channel);
    if (channel >= 0 && channel < 4) return { ...node, generator: 'op-unpack', params: {} };
    const code =
      params.premultiplied === false
        ? 'v = vec4(vec3(luminance(v.rgb)), 1.0);'
        : 'v = vec4(vec3(luminance(v.rgb) * v.a), 1.0);';
    return { ...node, generator: 'op-custom', params: { code } };
  });
  const links = (Array.isArray(raw.links) ? raw.links : []).map(record).map((l) => {
    let link = l;
    const toChannel = channelOf.get(String(l.to));
    if (toChannel !== undefined && toChannel >= 4 && l.input === 'image')
      link = { ...l, input: 'a' };
    const fromChannel = channelOf.get(String(l.from));
    if (fromChannel !== undefined && fromChannel < 4)
      link = { ...link, output: CHANNEL_OUTPUTS[fromChannel] };
    return link;
  });
  return { ...raw, version: 6, nodes: outNodes, links };
}

/**
 * v6 -> v7: Surface Wear (one generator whose modes used different params) was split into
 * Brushed Metal, Scratches and Cracked Glass; each keeps the values it used.
 */
function migrateV6toV7(raw: Record<string, unknown>): Record<string, unknown> {
  const pick = (params: Record<string, unknown>, keys: readonly string[]) =>
    Object.fromEntries(keys.filter((k) => k in params).map((k) => [k, params[k]]));
  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : []).map(record).map((node) => {
    if (node.generator !== 'surface-wear') return node;
    const params = record(node.params);
    const mode = typeof params.mode === 'number' ? Math.round(params.mode) : 0;
    if (mode === 3)
      return {
        ...node,
        generator: 'cracked-glass',
        params: pick(params, ['cracks', 'amount', 'length', 'width']),
      };
    if (mode === 2)
      return {
        ...node,
        generator: 'scratches',
        params: pick(params, ['density', 'amount', 'angle', 'spread', 'length', 'width']),
      };
    return {
      ...node,
      generator: 'brushed-metal',
      params: { ...pick(params, ['density', 'amount']), style: mode === 1 ? 1 : 0 },
    };
  });
  return { ...raw, version: 7, nodes };
}

/** v7 -> v8: convert the retired Levels & Math operator to Math. */
function migrateV7toV8(raw: Record<string, unknown>): Record<string, unknown> {
  const neutralLevels: Record<string, string> = {
    u_inLow: '0.0',
    u_inHigh: '1.0',
    u_gamma: '1.0',
    u_outLow: '0.0',
    u_outHigh: '1.0',
  };
  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : []).map(record).map((node) => {
    if (node.generator !== 'op-levels') return node;
    // Edited GLSL may still read the removed uniforms. Give them identity values.
    const code =
      typeof node.code === 'string'
        ? node.code.replace(
            /\bu_(?:inLow|inHigh|gamma|outLow|outHigh)\b/g,
            (key) => neutralLevels[key]!,
          )
        : node.code;
    return { ...node, generator: 'op-math', code };
  });
  return { ...raw, version: 8, nodes };
}

const finite = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Validated copy of an untrusted node, or null when its generator is unknown. */
function sanitizeNode(raw: unknown, lookup: GeneratorLookup): GraphNode | null {
  const obj = record(raw);
  const def = typeof obj.generator === 'string' ? lookup(obj.generator) : undefined;
  if (!def || typeof obj.id !== 'string' || !/^[\w-]{1,32}$/.test(obj.id)) return null;
  // Parameters created in the Code view (shader generators without a code param).
  const custom =
    def.kind === 'shader' && !def.codeParam
      ? sanitizeCustomParams(obj.customParams, new Set(def.params.map((p) => p.key)))
      : [];
  const edits =
    def.kind === 'shader' && !def.codeParam
      ? sanitizeBaseParamEdits(obj.baseParamEdits, def.params)
      : {};
  const baseParamEdits = Object.keys(edits).length ? edits : undefined;
  const effective = effectiveGenerator(def, { customParams: custom, baseParamEdits });
  return {
    id: obj.id,
    generator: def.id,
    x: clamp(finite(obj.x, 0), -1e6, 1e6),
    y: clamp(finite(obj.y, 0), -1e6, 1e6),
    params: sanitizeValues(effective.params, obj.params),
    ...(typeof obj.seed === 'number' && Number.isFinite(obj.seed)
      ? { seed: clamp(Math.round(obj.seed), 0, MAX_SEED) }
      : {}),
    post: sanitizeValues(POST_PARAMS, obj.post, postDefaults(def)),
    ramp: sanitizeGradient(obj.ramp) ?? DEFAULT_RAMP,
    postEnabled: obj.postEnabled !== false,
    frozenAt:
      typeof obj.frozenAt === 'number' && Number.isFinite(obj.frozenAt) ? obj.frozenAt : null,
    ...(obj.collapsed === true ? { collapsed: true } : {}),
    ...(custom.length ? { customParams: custom } : {}),
    ...(baseParamEdits ? { baseParamEdits } : {}),
    ...(typeof obj.code === 'string' &&
    obj.code.length <= MAX_NODE_CODE &&
    def.kind === 'shader' &&
    !def.codeParam
      ? { code: obj.code }
      : {}),
  };
}

/** Validates untrusted input (file, URL, storage) into a complete, safe document. */
export function parseDocument(raw: unknown, lookup: GeneratorLookup): TextureDocument {
  if (typeof raw !== 'object' || raw === null) throw new DocumentError('Not a document');
  const obj = raw as Record<string, unknown>;
  if (obj.format !== DOCUMENT_FORMAT && !LEGACY_FORMATS.includes(String(obj.format)))
    throw new DocumentError('Not an FX Designer document');
  const data = migrate(obj);

  const rawNodes: unknown[] = Array.isArray(data.nodes) ? data.nodes : [];
  const nodes: GraphNode[] = [];
  for (const r of rawNodes.slice(0, 256)) {
    const node = sanitizeNode(r, lookup);
    if (node && !nodes.some((n) => n.id === node.id)) nodes.push(node);
  }
  if (nodes.length === 0) {
    const first = record(rawNodes[0]).generator;
    throw new DocumentError(`Unknown generator "${String(first)}"`);
  }

  const links: GraphLink[] = [];
  const rawLinks: unknown[] = Array.isArray(data.links) ? data.links : [];
  for (const r of rawLinks) {
    const l = record(r);
    const to = nodes.find((n) => n.id === l.to);
    const def = to ? lookup(to.generator) : undefined;
    if (typeof l.from !== 'string' || typeof l.input !== 'string' || !to || !def) continue;
    const from = nodes.find((n) => n.id === l.from);
    const fromDef = from ? lookup(from.generator) : undefined;
    const output = typeof l.output === 'string' ? l.output : undefined;
    if (!fromDef || !hasOutput(fromDef, output)) continue;
    if (!inputsOf(def).some((i) => i.key === l.input)) continue;
    if (links.some((k) => k.to === to.id && k.input === l.input)) continue;
    if (dependsOn(links, l.from, to.id)) continue;
    links.push(
      output
        ? { from: l.from, to: to.id, input: l.input, output }
        : { from: l.from, to: to.id, input: l.input },
    );
  }

  const selected =
    typeof data.selected === 'string' && nodes.some((n) => n.id === data.selected)
      ? data.selected
      : nodes[0]!.id;
  return {
    format: DOCUMENT_FORMAT,
    version: DOCUMENT_VERSION,
    nodes,
    links,
    selected,
    resolution: nearestResolution(finite(data.resolution, 512)),
    seed: clamp(Math.round(finite(data.seed, 0)), 0, MAX_SEED),
    aspect: ASPECTS.find((a) => Math.abs(a - finite(data.aspect, 1)) < 1e-6) ?? 1,
  };
}

export function serializeDocument(doc: TextureDocument): string {
  return JSON.stringify(doc, null, 2);
}

export function encodeDocumentForUrl(doc: TextureDocument): string {
  return encodeBase64Url(JSON.stringify(doc));
}

/** Returns the raw decoded JSON (to be passed to parseDocument), or throws DocumentError. */
export function decodeDocumentFromUrl(encoded: string): unknown {
  try {
    return JSON.parse(decodeBase64Url(encoded));
  } catch {
    throw new DocumentError('Corrupted share link');
  }
}
