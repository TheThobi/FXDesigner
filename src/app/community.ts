/**
 * Community client: systems and custom shader nodes shared by their authors on the FX
 * Designer server (server/src/community.ts). Browsing works signed out; publishing and
 * subscribing need an account. The versions of the systems copied into the library are
 * remembered locally, to tell when a subscribed system got an update (installed nodes keep
 * their own version, see communityNodes.ts).
 */
import { readStorage, writeStorage } from '../util/storage';
import { call } from './cloud';
import { publicationVersion } from './library';

export interface CommunityCategory {
  readonly id: string;
  readonly label: string;
}

export type CommunitySort = 'trending' | 'popular' | 'new';
/** What a publication shares: a whole system, or one custom shader node. */
export type PublicationKind = 'system' | 'node';
export type CommunityScope = 'all' | 'subscribed' | 'mine';
/** Animated systems move (time, simulations); static ones are still images. */
export type CommunityKind = 'all' | 'animated' | 'static';

export interface CommunitySummary {
  readonly id: string;
  /** Absent from older servers: a system. */
  readonly kind?: PublicationKind;
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
  /** Hidden by reports or a moderator (only its author and moderators see it). */
  readonly hidden: boolean;
}

export const REPORT_REASONS = [
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'spam', label: 'Spam or advertising' },
  { id: 'copyright', label: "Someone else's work" },
  { id: 'broken', label: 'Broken or empty' },
  { id: 'other', label: 'Other' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

/** A system in the moderation queue, with its reports (newest first). */
export interface ReportedSystem extends CommunitySummary {
  readonly reportCount: number;
  readonly reports: readonly {
    readonly reason: ReportReason;
    readonly details: string;
    readonly by: string;
    readonly at: number;
  }[];
}

export interface CommunitySystem extends CommunitySummary {
  readonly document: unknown;
}

export interface CommunityQuery {
  readonly type: PublicationKind;
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
      type: query.type,
      scope: query.scope,
      kind: query.kind === 'all' ? '' : query.kind,
      sort: query.sort,
      category: query.category,
      q: query.q,
      page: String(query.page),
    });
    const result = await call<{ items: CommunitySummary[]; more: boolean }>(
      `community?${params.toString()}`,
    );
    for (const item of result.items) this.seen(item);
    return result;
  }

  async get(id: string): Promise<CommunitySystem> {
    const system = await call<CommunitySystem>(`community/${encodeURIComponent(id)}`);
    this.seen(system);
    return system;
  }

  /** Latest version seen online this session (update badges of installed nodes). */
  latestVersion(id: string): number | null {
    return this.latest.get(id) ?? null;
  }

  private readonly latest = new Map<string, number>();

  private seen(item: Pick<CommunitySummary, 'id' | 'version'>): void {
    const version = publicationVersion(item.version);
    if (version !== null) this.latest.set(item.id, version);
  }

  async suggestTags(query: string, exclude: readonly string[], type: PublicationKind = 'system') {
    const params = new URLSearchParams({ q: query, type });
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

  /** Publishes a new system (or node package): its community id and version (1). */
  async publish(
    fields: PublishFields,
    document: unknown,
    media: PublishMedia,
    kind: PublicationKind = 'system',
  ): Promise<{ id: string; version: number | null }> {
    const result = await call<{ id: string; version?: unknown }>('community', {
      method: 'POST',
      body: JSON.stringify({ ...fields, ...media, kind, document }),
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

  async report(id: string, reason: ReportReason, details: string): Promise<void> {
    await call(`community/${encodeURIComponent(id)}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, details }),
    });
  }

  /** Whether the signed-in user moderates the community (false on any error). */
  async isModerator(): Promise<boolean> {
    try {
      return (await call<{ moderator: boolean }>('community/moderator')).moderator;
    } catch {
      return false;
    }
  }

  async reports(): Promise<ReportedSystem[]> {
    return (await call<{ items: ReportedSystem[] }>('community/reports')).items;
  }

  /** Moderator decision: hide or show `id`, optionally dismissing its reports. */
  async moderate(id: string, hidden: boolean, dismiss = false): Promise<void> {
    await call(`community/${encodeURIComponent(id)}/moderation`, {
      method: 'PUT',
      body: JSON.stringify({ hidden, dismiss }),
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
