/**
 * Library of systems: several independent graphs (documents) kept in localStorage, so effects
 * don't all have to live in one giant graph, optionally sorted into folders. One system is
 * "current": the autosave writes to it. Documents are stored raw and validated by
 * `parseDocument` when opened. Every local change is reported through `onChange` (account
 * sync, see app/cloud.ts); `applyRemote*` methods write server data without reporting it back.
 */
import { readStorage, writeStorage } from '../util/storage';
import { fnv1a } from '../util/hash';

export interface SystemEntry {
  readonly id: string;
  readonly name: string;
  /** Last save (ms since epoch). */
  readonly updated: number;
  /** Small preview (data URL) of the selected node, when captured. */
  readonly thumb: string | null;
  /** Folder id, or null at the top level. */
  readonly folder: string | null;
  /** Community publication of this system (yours), absent / null when it is local only. */
  readonly published?: PublishedLink | null;
}

/** Link from a library system to the community system it was published as. */
export interface PublishedLink {
  /** Community id. */
  readonly id: string;
  /** Version published last, or null for older server responses that omitted it. */
  readonly version: number | null;
  /** `contentHash` of the document published last (tells local edits apart). */
  readonly hash: string;
  /** Framing of the community preview, reused for the next versions. */
  readonly framing?: PreviewFraming;
}

/** How the community preview shows the effect (see ui/PreviewStudio.ts). */
export interface PreviewFraming {
  /** 1 = the whole image, 4 = a quarter of its width. */
  readonly zoom: number;
  /** Center of the shown area, in [0, 1] (y down). */
  readonly cx: number;
  readonly cy: number;
  /** Poster frame among the preview frames. */
  readonly frame: number;
  readonly background: 'checker' | 'black' | 'dark';
}

/** Publication state of a system in the library. */
export type PublishState = 'local' | 'published' | 'modified';

/**
 * Hash of a document's content (the selection is not content): equal hashes = nothing to
 * publish. FNV-1a over the JSON.
 */
export function contentHash(doc: unknown): string {
  const { selected: _selected, ...rest } =
    doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : { selected: null };
  return fnv1a(JSON.stringify(rest));
}

export function publicationVersion(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0 ? raw : null;
}

function parseLink(raw: unknown): PublishedLink | null {
  const p = raw as Partial<PublishedLink> | null;
  if (!p || typeof p !== 'object') return null;
  if (typeof p.id !== 'string' || !p.id || typeof p.hash !== 'string') return null;
  return {
    id: p.id,
    version: publicationVersion(p.version),
    hash: p.hash,
    ...(p.framing ? { framing: p.framing } : {}),
  };
}

export interface FolderEntry {
  readonly id: string;
  readonly name: string;
  readonly updated: number;
}

export type LibraryChange =
  | { readonly kind: 'system'; readonly id: string }
  | { readonly kind: 'system-removed'; readonly id: string }
  | { readonly kind: 'folder'; readonly id: string }
  | { readonly kind: 'folder-removed'; readonly id: string };

/** A whole library saved as one file (File → Save library). */
export interface LibraryFile {
  readonly format: typeof LIBRARY_FORMAT;
  readonly version: 1 | 2;
  readonly folders?: readonly { readonly id: string; readonly name: string }[];
  readonly systems: readonly {
    readonly name: string;
    readonly updated: number;
    readonly thumb: string | null;
    readonly folder?: string | null;
    readonly document: unknown;
  }[];
}

export const LIBRARY_FORMAT = 'fx-designer-library';
const INDEX_KEY = 'ptm.library.index';
const FOLDERS_KEY = 'ptm.library.folders';
const CURRENT_KEY = 'ptm.library.current';
const DOC_PREFIX = 'ptm.library.doc.';
export const MAX_NAME = 64;

function isEntry(v: unknown): v is SystemEntry {
  const e = v as Partial<SystemEntry> | null;
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.updated === 'number' &&
    (e.thumb === null || typeof e.thumb === 'string')
  );
}

function isFolder(v: unknown): v is FolderEntry {
  const f = v as Partial<FolderEntry> | null;
  return (
    typeof f === 'object' && f !== null && typeof f.id === 'string' && typeof f.name === 'string'
  );
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(readStorage(key) ?? '[]') as unknown;
  } catch {
    return [];
  }
}

/** Random id (12 base-36 characters): unique across devices for account sync. */
export function randomId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

export class Library {
  private entries: SystemEntry[];
  private folderList: FolderEntry[];
  /** Local edits (not the ones applied from the server). */
  onChange: ((change: LibraryChange) => void) | null = null;

  constructor(private readonly now: () => number = Date.now) {
    const raw = readJson(INDEX_KEY);
    this.entries = (Array.isArray(raw) ? raw.filter(isEntry) : []).map((e) => ({
      ...e,
      folder: typeof e.folder === 'string' ? e.folder : null,
      published: parseLink(e.published),
    }));
    const folders = readJson(FOLDERS_KEY);
    this.folderList = (Array.isArray(folders) ? folders.filter(isFolder) : []).map((f) => ({
      ...f,
      updated: typeof f.updated === 'number' ? f.updated : 0,
    }));
    // Systems in a folder that no longer exists go back to the top level.
    const ids = new Set(this.folderList.map((f) => f.id));
    this.entries = this.entries.map((e) =>
      e.folder && !ids.has(e.folder) ? { ...e, folder: null } : e,
    );
  }

  /** Systems, most recently edited first. */
  list(): readonly SystemEntry[] {
    return [...this.entries].sort((a, b) => b.updated - a.updated);
  }

  /** Folders by name. */
  folders(): readonly FolderEntry[] {
    return [...this.folderList].sort((a, b) => a.name.localeCompare(b.name));
  }

  get(id: string): SystemEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  folder(id: string): FolderEntry | undefined {
    return this.folderList.find((f) => f.id === id);
  }

  get currentId(): string | null {
    const id = readStorage(CURRENT_KEY);
    return id && this.get(id) ? id : null;
  }

  setCurrent(id: string): void {
    if (this.get(id)) writeStorage(CURRENT_KEY, id);
  }

  /** Raw document of system `id` (to validate with parseDocument), or null. */
  load(id: string): unknown {
    try {
      return JSON.parse(readStorage(DOC_PREFIX + id) ?? 'null') as unknown;
    } catch {
      return null;
    }
  }

  /** Stores `doc` as system `id` (thumbnail kept unless a new one is given). */
  save(id: string, doc: unknown, thumb?: string | null): void {
    const entry = this.get(id);
    if (!entry) return;
    const json = JSON.stringify(doc);
    const changed =
      json !== readStorage(DOC_PREFIX + id) || (thumb !== undefined && thumb !== entry.thumb);
    if (!changed) return;
    writeStorage(DOC_PREFIX + id, json);
    this.update(id, { updated: this.now(), ...(thumb !== undefined ? { thumb } : {}) });
  }

  create(name: string, doc: unknown, folder: string | null = null): SystemEntry {
    const entry: SystemEntry = {
      id: randomId('s'),
      name: this.uniqueName(name),
      updated: this.now(),
      thumb: null,
      folder: folder && this.folder(folder) ? folder : null,
    };
    this.entries.push(entry);
    writeStorage(DOC_PREFIX + entry.id, JSON.stringify(doc));
    this.persist();
    this.onChange?.({ kind: 'system', id: entry.id });
    return entry;
  }

  duplicate(id: string): SystemEntry | null {
    const source = this.get(id);
    if (!source) return null;
    const copy = this.create(`${source.name} copy`, this.load(id), source.folder);
    this.update(copy.id, { thumb: source.thumb });
    return this.get(copy.id) ?? copy;
  }

  /** Links system `id` to its community publication (null: local only again). */
  setPublished(id: string, link: PublishedLink | null): void {
    this.update(id, { published: parseLink(link), updated: this.now() });
  }

  /** Whether system `id` is local only, published as is, or edited since it was published. */
  publishState(id: string): PublishState {
    const link = this.get(id)?.published;
    if (!link) return 'local';
    return contentHash(this.load(id)) === link.hash ? 'published' : 'modified';
  }

  /** The library system published as community system `communityId`, if any. */
  findPublished(communityId: string): SystemEntry | undefined {
    return this.entries.find((e) => e.published?.id === communityId);
  }

  rename(id: string, name: string): void {
    this.update(id, {
      name: name.trim().slice(0, MAX_NAME) || 'Untitled system',
      updated: this.now(),
    });
  }

  /** Moves system `id` into `folder` (null = top level). */
  move(id: string, folder: string | null): void {
    const entry = this.get(id);
    const target = folder && this.folder(folder) ? folder : null;
    if (!entry || entry.folder === target) return;
    this.update(id, { folder: target, updated: this.now() });
  }

  remove(id: string): void {
    if (!this.get(id)) return;
    this.dropSystem(id);
    this.onChange?.({ kind: 'system-removed', id });
  }

  createFolder(name: string): FolderEntry {
    const folder: FolderEntry = {
      id: randomId('f'),
      name: name.trim().slice(0, MAX_NAME) || 'Folder',
      updated: this.now(),
    };
    this.folderList.push(folder);
    this.persistFolders();
    this.onChange?.({ kind: 'folder', id: folder.id });
    return folder;
  }

  renameFolder(id: string, name: string): void {
    if (!this.folder(id)) return;
    this.folderList = this.folderList.map((f) =>
      f.id === id
        ? { ...f, name: name.trim().slice(0, MAX_NAME) || f.name, updated: this.now() }
        : f,
    );
    this.persistFolders();
    this.onChange?.({ kind: 'folder', id });
  }

  /** Deletes folder `id`; its systems go back to the top level. */
  removeFolder(id: string): void {
    if (!this.folder(id)) return;
    for (const e of this.entries) if (e.folder === id) this.move(e.id, null);
    this.folderList = this.folderList.filter((f) => f.id !== id);
    this.persistFolders();
    this.onChange?.({ kind: 'folder-removed', id });
  }

  // ---- Server data (account sync): written without reporting changes -------------------------

  /** Inserts or replaces system `entry` and its document as received from the server. */
  applyRemoteSystem(entry: SystemEntry, doc: unknown): void {
    const fixed = {
      ...entry,
      // An omitted field from an older server is not an explicit unlink.
      published:
        entry.published === undefined
          ? (this.get(entry.id)?.published ?? null)
          : parseLink(entry.published),
      folder: entry.folder && this.folder(entry.folder) ? entry.folder : null,
    };
    const exists = this.get(entry.id);
    this.entries = exists
      ? this.entries.map((e) => (e.id === entry.id ? fixed : e))
      : [...this.entries, fixed];
    writeStorage(DOC_PREFIX + entry.id, JSON.stringify(doc));
    this.persist();
  }

  applyRemoteFolder(folder: FolderEntry): void {
    const exists = this.folder(folder.id);
    this.folderList = exists
      ? this.folderList.map((f) => (f.id === folder.id ? folder : f))
      : [...this.folderList, folder];
    this.persistFolders();
  }

  applyRemoteRemoval(kind: 'system' | 'folder', id: string): void {
    if (kind === 'system') this.dropSystem(id);
    else {
      this.entries = this.entries.map((e) => (e.folder === id ? { ...e, folder: null } : e));
      this.folderList = this.folderList.filter((f) => f.id !== id);
      this.persist();
      this.persistFolders();
    }
  }

  // ---- Files ---------------------------------------------------------------------------------

  /** Every system with its raw document, and the folders (a library file). */
  exportAll(): LibraryFile {
    return {
      format: LIBRARY_FORMAT,
      version: 2,
      folders: this.folders().map((f) => ({ id: f.id, name: f.name })),
      systems: this.list().map((e) => ({
        name: e.name,
        updated: e.updated,
        thumb: e.thumb,
        folder: e.folder,
        document: this.load(e.id),
      })),
    };
  }

  /**
   * Adds the folders and systems of a library file whose document `accept` validates (names
   * made unique); returns the new systems. Throws when `raw` is not a library file.
   */
  importAll(raw: unknown, accept: (doc: unknown) => boolean): SystemEntry[] {
    const file = raw as Partial<LibraryFile> | null;
    if (typeof file !== 'object' || file === null || file.format !== LIBRARY_FORMAT)
      throw new Error('Not an FX Designer library file');
    // Folders of the file map onto existing folders of the same name, or new ones.
    const folderMap = new Map<string, string>();
    for (const f of Array.isArray(file.folders) ? file.folders : []) {
      if (!isFolder(f)) continue;
      const existing = this.folderList.find((x) => x.name === f.name);
      folderMap.set(f.id, existing?.id ?? this.createFolder(f.name).id);
    }
    const added: SystemEntry[] = [];
    for (const s of Array.isArray(file.systems) ? file.systems : []) {
      if (typeof s !== 'object' || s === null || !accept(s.document)) continue;
      const name = typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'Imported system';
      const folder = typeof s.folder === 'string' ? (folderMap.get(s.folder) ?? null) : null;
      const entry = this.create(name.slice(0, MAX_NAME), s.document, folder);
      const thumb =
        typeof s.thumb === 'string' && s.thumb.startsWith('data:image/') ? s.thumb : null;
      this.update(entry.id, { thumb });
      added.push(this.get(entry.id) ?? entry);
    }
    return added;
  }

  /** `name`, or `name 2`, `name 3`… when taken. */
  uniqueName(name: string): string {
    const taken = new Set(this.entries.map((e) => e.name));
    if (!taken.has(name)) return name;
    let i = 2;
    while (taken.has(`${name} ${i}`)) i++;
    return `${name} ${i}`;
  }

  private dropSystem(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
    try {
      localStorage.removeItem(DOC_PREFIX + id);
    } catch {
      // Storage disabled: nothing was stored anyway.
    }
    this.persist();
  }

  private update(id: string, patch: Partial<Omit<SystemEntry, 'id'>>): void {
    if (!this.get(id)) return;
    this.entries = this.entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    this.persist();
    this.onChange?.({ kind: 'system', id });
  }

  private persist(): void {
    writeStorage(INDEX_KEY, JSON.stringify(this.entries));
  }

  private persistFolders(): void {
    writeStorage(FOLDERS_KEY, JSON.stringify(this.folderList));
  }
}
