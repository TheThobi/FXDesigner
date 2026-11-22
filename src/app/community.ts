/**
 * Community client: systems shared by their authors on the FX Designer server
 * (server/src/community.ts). Browsing works signed out; publishing and subscribing need an
 * account. The versions of the systems copied into the library are remembered locally, to
 * tell when a subscribed system got an update.
 */
import { readStorage, writeStorage } from '../util/storage';
import { call } from './cloud';
import { publicationVersion } from './library';

export interface CommunityCategory {
  readonly id: string;
  readonly label: string;
}

export type CommunitySort = 'trending' | 'popular' | 'new';
export type CommunityScope = 'all' | 'subscribed' | 'mine';
/** Animated systems move (time, simulations); static ones are still images. */
export type CommunityKind = 'all' | 'animated' | 'static';

export interface CommunitySummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly thumb: string | null;
  readonly animated: boolean;
  /** Frames of the hover animation strip (0 = none). */
  readonly previewFrames: number;
  readonly version: number;
  readonly uses: number;
  readonly created: number;
  readonly updated: number;
  readonly author: string;
  readonly mine: boolean;
  readonly subscribers: number;
  readonly subscribed: boolean;
}

export interface CommunitySystem extends CommunitySummary {
  readonly document: unknown;
}

export interface CommunityQuery {
  readonly scope: CommunityScope;
  readonly kind: CommunityKind;
  readonly sort: CommunitySort;
  readonly category: string;
  readonly q: string;
  readonly page: number;
}

export interface PublishFields {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
}

/** What a version sends besides its document: images and kind. */
export interface PublishMedia {
  readonly animated: boolean;
  readonly thumb: string | null;
  /** Hover animation: frames side by side in one image (animated systems). */
  readonly preview: string | null;
  readonly previewFrames: number;
}

/** A hover animation strip: `frames` images side by side. */
export interface PreviewStrip {
  readonly url: string;
  readonly frames: number;
}

const COPIES_KEY = 'ptm.community.copies';

export class Community {
  private categoryList: readonly CommunityCategory[] | null = null;
  /** community id -> version last copied into the library. */
  private copies: Record<string, number>;

  constructor() {
    let raw: unknown;
    try {
      raw = JSON.parse(readStorage(COPIES_KEY) ?? '{}');
    } catch {
      raw = null;
    }
    this.copies =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? Object.fromEntries(
            Object.entries(raw as Record<string, unknown>).filter(
              (e): e is [string, number] => typeof e[1] === 'number',
            ),
          )
        : {};
  }

  async categories(): Promise<readonly CommunityCategory[]> {
    this.categoryList ??= (
      await call<{ categories: CommunityCategory[] }>('community/categories')
    ).categories;
    return this.categoryList;
  }

  async list(query: CommunityQuery): Promise<{ items: CommunitySummary[]; more: boolean }> {
    const params = new URLSearchParams({
      scope: query.scope,
      kind: query.kind === 'all' ? '' : query.kind,
      sort: query.sort,
      category: query.category,
      q: query.q,
      page: String(query.page),
    });
    return call(`community?${params.toString()}`);
  }

  get(id: string): Promise<CommunitySystem> {
    return call(`community/${encodeURIComponent(id)}`);
  }

  async suggestTags(query: string, exclude: readonly string[]) {
    const params = new URLSearchParams({ q: query });
    for (const tag of exclude) params.append('exclude', tag);
    const result = await call<{ tags: { tag: string; count: number }[] }>(
      `community/tags?${params}`,
    );
    return result.tags;
  }

  /** Hover animation of an animated system (cached). */
  async preview(id: string): Promise<PreviewStrip | null> {
    if (!this.previews.has(id))
      this.previews.set(
        id,
        call<PreviewStrip>(`community/${encodeURIComponent(id)}/preview`).catch(() => null),
      );
    return this.previews.get(id)!;
  }

  private readonly previews = new Map<string, Promise<PreviewStrip | null>>();

  /** Publishes a new system: its community id and version (1). */
  async publish(
    fields: PublishFields,
    document: unknown,
    media: PublishMedia,
  ): Promise<{ id: string; version: number | null }> {
    const result = await call<{ id: string; version?: unknown }>('community', {
      method: 'POST',
      body: JSON.stringify({ ...fields, ...media, document }),
    });
    return { id: result.id, version: await this.resolveVersion(result.id, result.version) };
  }

  /**
   * Edits the metadata; with a document, publishes a new version (with its media). Returns
   * the version now online.
   */
  async update(
    id: string,
    fields: Partial<PublishFields>,
    document?: unknown,
    media?: Partial<PublishMedia>,
  ): Promise<number | null> {
    this.previews.delete(id);
    const r = await call<{ version: number }>(`community/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...fields,
        ...(document !== undefined ? { document } : {}),
        ...(media ?? {}),
      }),
    });
    return this.resolveVersion(id, r.version);
  }

  /** Older servers acknowledge a successful write without returning its version. */
  private async resolveVersion(id: string, raw: unknown): Promise<number | null> {
    const version = publicationVersion(raw);
    if (version !== null) return version;
    try {
      return publicationVersion((await this.get(id)).version);
    } catch {
      // The write succeeded: keep its link even if this follow-up request fails.
      return null;
    }
  }

  async remove(id: string): Promise<void> {
    await call(`community/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async subscribe(id: string, on: boolean): Promise<void> {
    await call(`community/${encodeURIComponent(id)}/subscription`, {
      method: on ? 'PUT' : 'DELETE',
    });
  }

  /** Records a copy into the library (popularity counter, update badge). */
  markCopied(id: string, version: number): void {
    this.copies[id] = version;
    writeStorage(COPIES_KEY, JSON.stringify(this.copies));
    void call(`community/${encodeURIComponent(id)}/use`, { method: 'POST' }).catch(() => undefined);
  }

  /** Version last copied into the library, or null. */
  copiedVersion(id: string): number | null {
    return this.copies[id] ?? null;
  }
}
