import { IdbStore } from '../util/idb';
import { readStorage } from '../util/storage';

/** localStorage key of the previous cache (simulations only), migrated once. */
const LEGACY_KEY = 'ptm.thumbnails.v2';

interface Thumbnail {
  /** Fingerprint of what the image was rendered from (stale when it differs). */
  readonly hash: string;
  readonly url: string;
}

/**
 * Generator browser thumbnails kept between visits (IndexedDB), so a launch doesn't compile
 * and render every visible generator again. Shader thumbnails are keyed by a fingerprint of
 * their sources and settings: a changed generator renders again. Simulations, which cannot
 * be rendered offline, are captured from the live preview (fingerprint `sim`).
 */
export class ThumbnailCache {
  private readonly store = new IdbStore<Thumbnail>('ptm-cache', 'thumbnails');
  private readonly map = new Map<string, Thumbnail>();
  /** Resolves once stored thumbnails are loaded. */
  readonly loaded: Promise<void>;

  constructor() {
    this.loaded = this.load();
  }

  entries(): [string, Thumbnail][] {
    return [...this.map.entries()];
  }

  /** The stored image of `id` if it was rendered from `hash`. */
  get(id: string, hash: string): string | undefined {
    const entry = this.map.get(id);
    return entry?.hash === hash ? entry.url : undefined;
  }

  set(id: string, hash: string, url: string): void {
    const entry = { hash, url };
    this.map.set(id, entry);
    void this.store.put(id, entry);
  }

  private async load(): Promise<void> {
    for (const [id, entry] of await this.store.all()) {
      if (
        typeof entry?.hash === 'string' &&
        typeof entry.url === 'string' &&
        entry.url.startsWith('data:image/')
      )
        this.map.set(id, entry);
    }
    this.migrate();
  }

  /** Simulation thumbnails of the localStorage cache move to IndexedDB (freeing the quota). */
  private migrate(): void {
    const raw = readStorage(LEGACY_KEY);
    if (raw === null) return;
    try {
      const old = JSON.parse(raw) as unknown;
      if (typeof old === 'object' && old !== null) {
        for (const [id, url] of Object.entries(old)) {
          if (typeof url === 'string' && url.startsWith('data:image/') && !this.map.has(id))
            this.set(id, SIM_THUMBNAIL, url);
        }
      }
    } catch {
      // Unreadable: dropped.
    }
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Ignore.
    }
  }
}

/** Fingerprint of simulation thumbnails (captured live, kept until replaced). */
export const SIM_THUMBNAIL = 'sim';
