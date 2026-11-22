// v2: thumbnails without preset colors (older ones are dropped).
const STORAGE_KEY = 'ptm.thumbnails.v2';

/**
 * Persistent thumbnails for generators that cannot be rendered offline (simulations): they are
 * captured from the live preview once it has run for a while, and kept in localStorage.
 */
export class ThumbnailCache {
  private readonly map: Map<string, string>;

  constructor() {
    this.map = new Map(Object.entries(this.load()));
  }

  entries(): IterableIterator<[string, string]> {
    return this.map.entries();
  }

  set(id: string, dataUrl: string): void {
    this.map.set(id, dataUrl);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.map)));
    } catch {
      // Best effort (quota / private mode).
    }
  }

  private load(): Record<string, string> {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown;
      if (typeof raw !== 'object' || raw === null) return {};
      return Object.fromEntries(
        Object.entries(raw).filter(
          (e): e is [string, string] => typeof e[1] === 'string' && e[1].startsWith('data:image/'),
        ),
      );
    } catch {
      return {};
    }
  }
}
