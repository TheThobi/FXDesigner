import { readStorage, writeStorage } from '../util/storage';

/** Parts of the editor the user can show or hide. */
export const LAYOUT_PARTS = [
  { id: 'browser', label: 'Generator browser', shortcut: '' },
  { id: 'details', label: 'Details panel', shortcut: '' },
  { id: 'timeline', label: 'Timeline', shortcut: 'T' },
  { id: 'stats', label: 'Stats', shortcut: '' },
] as const;

export type LayoutPart = (typeof LAYOUT_PARTS)[number]['id'];

const STORAGE_KEY = 'ptm.ui.layout.v2';
/** Hidden until the user shows them. */
const HIDDEN_BY_DEFAULT: readonly LayoutPart[] = ['stats'];

/**
 * Visibility of the optional editor parts, persisted per browser. Applied as `hide-<part>`
 * classes on the app root; CSS collapses the corresponding grid tracks.
 */
export class Layout {
  private readonly hidden = new Set<LayoutPart>();
  /** Called after any change (e.g. to refresh the layout menu or re-render). */
  onChange: (() => void) | null = null;

  constructor(private readonly root: HTMLElement) {
    try {
      const stored = readStorage(STORAGE_KEY);
      const saved = (stored === null ? HIDDEN_BY_DEFAULT : JSON.parse(stored)) as unknown;
      if (Array.isArray(saved)) {
        for (const id of saved) if (LAYOUT_PARTS.some((p) => p.id === id)) this.hidden.add(id);
      }
    } catch {
      // Corrupted preference: default layout.
    }
    this.apply();
  }

  isVisible(part: LayoutPart): boolean {
    return !this.hidden.has(part);
  }

  set(part: LayoutPart, visible: boolean): void {
    if (visible === this.isVisible(part)) return;
    if (visible) this.hidden.delete(part);
    else this.hidden.add(part);
    this.apply();
    writeStorage(STORAGE_KEY, JSON.stringify([...this.hidden]));
    this.onChange?.();
  }

  toggle(part: LayoutPart): void {
    this.set(part, !this.isVisible(part));
  }

  reset(): void {
    for (const p of LAYOUT_PARTS) this.set(p.id, !HIDDEN_BY_DEFAULT.includes(p.id));
  }

  private apply(): void {
    for (const p of LAYOUT_PARTS) this.root.classList.toggle(`hide-${p.id}`, this.hidden.has(p.id));
    // Canvas-size dependent code (zoom limits) listens to resize.
    window.dispatchEvent(new Event('resize'));
  }
}
