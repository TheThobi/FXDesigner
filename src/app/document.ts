/**
 * Portable, versioned description of a texture (generator + settings). Used for .json files,
 * share links and autosave. When the shape changes: bump DOCUMENT_VERSION and add a step to
 * `migrate()` so older files and links keep working.
 */
import type { GeneratorDefinition } from '../engine/generator';
import { upgradeLegacyPost } from '../engine/post/legacy';
import { DEFAULT_RAMP, POST_PARAMS } from '../engine/post/schema';
import { sanitizeGradient, type GradientValue } from '../params/gradient';
import type { ParamValues } from '../params/types';
import { sanitizeValues } from '../params/values';
import { decodeBase64Url, encodeBase64Url } from '../util/base64';
import { MAX_SEED } from '../util/random';
import { clamp } from '../util/math';
import {
  nearestResolution,
  paramsOf,
  pickScoped,
  postDefaults,
  postOf,
  type EditorState,
  type PostScope,
} from './state';

export const DOCUMENT_FORMAT = 'procedural-texture-maker';
export const DOCUMENT_VERSION = 2;

export interface TextureDocument {
  readonly format: typeof DOCUMENT_FORMAT;
  readonly version: typeof DOCUMENT_VERSION;
  readonly generator: string;
  readonly params: ParamValues;
  readonly post: ParamValues;
  readonly resolution: number;
  readonly seed: number;
  /** Shared color ramp (v2+). */
  readonly ramp: GradientValue;
  /** Post Process scope (optional in v2 files; missing = global). `post` is always complete. */
  readonly postScope: PostScope;
}

export class DocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentError';
  }
}

export type GeneratorLookup = (id: string) => GeneratorDefinition | undefined;

export function documentFromState(state: EditorState, lookup: GeneratorLookup): TextureDocument {
  const def = lookup(state.generatorId);
  if (!def) throw new DocumentError(`Unknown generator "${state.generatorId}"`);
  return {
    format: DOCUMENT_FORMAT,
    version: DOCUMENT_VERSION,
    generator: def.id,
    // Re-validated so values saved before a schema change (new param) are completed.
    params: sanitizeValues(def.params, paramsOf(state, def)),
    post: sanitizeValues(POST_PARAMS, postOf(state, def), postDefaults(def)),
    resolution: state.resolution,
    seed: state.seed,
    ramp: state.ramp,
    postScope: state.postScope,
  };
}

/** Merges a (validated) document into editor state, keeping other generators' values. */
export function applyDocument(state: EditorState, doc: TextureDocument): EditorState {
  return {
    generatorId: doc.generator,
    params: { ...state.params, [doc.generator]: doc.params },
    post: { ...state.post, [doc.generator]: doc.post },
    resolution: doc.resolution,
    seed: doc.seed,
    ramp: doc.ramp,
    postScope: doc.postScope,
    // The document's look becomes the shared one (global) or stays with its generator.
    sharedPost: doc.postScope === 'global' ? pickScoped(doc.post) : state.sharedPost,
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
  // Future: `if (data.version === 2) data = migrateV2toV3(data);` …
  return data;
}

/**
 * v1 -> v2: post-processing became on/off modules and the color ramp became shared.
 * A v1 per-generator gradient is kept as a ramp override so the look is preserved.
 */
function migrateV1toV2(raw: Record<string, unknown>): Record<string, unknown> {
  const post =
    typeof raw.post === 'object' && raw.post !== null ? (raw.post as Record<string, unknown>) : {};
  return { ...raw, version: 2, post: upgradeLegacyPost(post) };
}

/** Validates untrusted input (file, URL, storage) into a complete, safe document. */
export function parseDocument(raw: unknown, lookup: GeneratorLookup): TextureDocument {
  if (typeof raw !== 'object' || raw === null) throw new DocumentError('Not a document');
  const obj = raw as Record<string, unknown>;
  if (obj.format !== DOCUMENT_FORMAT)
    throw new DocumentError('Not a Procedural Texture Maker document');
  const data = migrate(obj);
  const def = typeof data.generator === 'string' ? lookup(data.generator) : undefined;
  if (!def) throw new DocumentError(`Unknown generator "${String(data.generator)}"`);
  const seed =
    typeof data.seed === 'number' && Number.isFinite(data.seed) ? Math.round(data.seed) : 0;
  const resolution =
    typeof data.resolution === 'number'
      ? nearestResolution(data.resolution)
      : nearestResolution(512);
  return {
    format: DOCUMENT_FORMAT,
    version: DOCUMENT_VERSION,
    generator: def.id,
    params: sanitizeValues(def.params, data.params),
    post: sanitizeValues(POST_PARAMS, data.post, postDefaults(def)),
    resolution,
    seed: clamp(seed, 0, MAX_SEED),
    ramp: sanitizeGradient(data.ramp) ?? DEFAULT_RAMP,
    postScope: data.postScope === 'local' ? 'local' : 'global',
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
