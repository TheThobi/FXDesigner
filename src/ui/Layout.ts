import { readStorage, writeStorage } from '../util/storage';

/** Parts of the editor the user can show or hide. */
export const LAYOUT_PARTS = [
  { id: 'browser', label: 'Generator browser', shortcut: '' },
  { id: 'details', label: 'Details panel', shortcut: '' },
  { id: 'timeline', label: 'Timeline', shortcut: 'T' },
  { id: 'preview3d', label: '3D preview', shortcut: '' },
  { id: 'stats', label: 'Stats', shortcut: '' },
] as const;

export type LayoutPart = (typeof LAYOUT_PARTS)[number]['id'];

const STORAGE_KEY = 'ptm.ui.layout.v2';
/** Parts that existed when the stored preference was saved (newer ones get their default). */
const KNOWN_KEY = 'ptm.ui.layout.known';
/** Parts saved before KNOWN_KEY existed. */
const LEGACY_PARTS: readonly string[] = ['browser', 'details', 'timeline', 'stats'];
/** Hidden until the user shows them. */
const HIDDEN_BY_DEFAULT: readonly LayoutPart[] = ['stats', 'preview3d'];

/**
 * Visibility of the optional editor parts, persisted per browser. Applied as `hide-<part>`
 * classes on the app root; CSS collapses the corresponding grid tracks.
 */
export class Layout {
  private readonly hidden = new Set<LayoutPart>();
  /** Called after any change (e.g. to refresh the layout menu or re-render). */
  onChange: (() => void) | null = null;
  /** Called by reset() (e.g. the dock arrangement goes back to its default). */
  onReset: (() => void) | null = null;

  constructor(private readonly root: HTMLElement) {
    try {
      const stored = readStorage(STORAGE_KEY);
      const saved = (stored === null ? HIDDEN_BY_DEFAULT : JSON.parse(stored)) as unknown;
      if (Array.isArray(saved)) {
        for (const id of saved) if (LAYOUT_PARTS.some((p) => p.id === id)) this.hidden.add(id);
      }
      // A part added since the preference was saved starts with its default visibility.
      const known = JSON.parse(readStorage(KNOWN_KEY) ?? 'null') as unknown;
      const knownIds = Array.isArray(known) ? (known as unknown[]) : LEGACY_PARTS;
      for (const id of HIDDEN_BY_DEFAULT) if (!knownIds.includes(id)) this.hidden.add(id);
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
    writeStorage(KNOWN_KEY, JSON.stringify(LAYOUT_PARTS.map((p) => p.id)));
    this.onChange?.();
  }

  toggle(part: LayoutPart): void {
    this.set(part, !this.isVisible(part));
  }

  reset(): void {
    for (const p of LAYOUT_PARTS) this.set(p.id, !HIDDEN_BY_DEFAULT.includes(p.id));
    this.onReset?.();
  }

  private apply(): void {
    for (const p of LAYOUT_PARTS) this.root.classList.toggle(`hide-${p.id}`, this.hidden.has(p.id));
    // Canvas-size dependent code (zoom limits) listens to resize.
    window.dispatchEvent(new Event('resize'));
  }
}
