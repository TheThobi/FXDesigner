import { readStorage, writeStorage } from '../util/storage';
import { h } from './dom';
import { icon, type IconName } from './icons';
import type { Layout, LayoutPart } from './Layout';

export type DockSide = 'left' | 'right';

export interface DockPanelSpec {
  /** Layout part (shown / hidden from the Layout menu). */
  readonly id: LayoutPart;
  readonly title: string;
  readonly icon: IconName;
  readonly element: HTMLElement;
}

interface Stack {
  readonly side: DockSide;
  readonly element: HTMLElement;
  readonly tabs: HTMLElement;
  ids: LayoutPart[];
  active: LayoutPart | null;
}

const STORAGE_KEY = 'ptm.ui.docks';
/** Pointer distance (px) before pressing a tab becomes a drag. */
const DRAG_THRESHOLD = 6;
/** Viewport edge (fraction of its width) that docks a panel on an empty side. */
const EDGE_ZONE = 0.18;

/**
 * Side docks of the editor. Each side (left / right of the viewport) is a stack of panels
 * shown as tabs; dragging a tab onto the other side moves the panel there (e.g. browser and
 * details stacked together on one side for a compact layout). A side without visible panels
 * collapses. The arrangement is persisted.
 */
export class DockManager {
  private readonly stacks: Record<DockSide, Stack>;
  private readonly panels = new Map<LayoutPart, DockPanelSpec>();
  private readonly dropHint: HTMLElement;

  constructor(
    private readonly dock: HTMLElement,
    private readonly viewport: HTMLElement,
    private readonly splitters: Record<DockSide, HTMLElement>,
    specs: readonly DockPanelSpec[],
    private readonly layout: Layout,
    /** Called after the arrangement changed (sizes of the viewport may have changed). */
    private readonly onChange: () => void,
  ) {
    for (const s of specs) this.panels.set(s.id, s);
    const stack = (side: DockSide): Stack => {
      const tabs = h('div', { class: 'panel-tabs dock-tabs', role: 'tablist' });
      return {
        side,
        tabs,
        element: h('div', { class: `dock-stack dock-${side}` }, tabs),
        ids: [],
        active: null,
      };
    };
    this.stacks = { left: stack('left'), right: stack('right') };
    this.dropHint = h('div', { class: 'dock-drop-hint', hidden: true });
    document.body.append(this.dropHint);

    // Default: browser on the left, details on the right; a saved arrangement wins.
    const saved = this.load();
    for (const spec of specs) {
      const stored = saved?.[spec.id];
      const side: DockSide =
        stored === 'left' || stored === 'right' ? stored : spec.id === 'details' ? 'right' : 'left';
      this.stacks[side].ids.push(spec.id);
      this.stacks[side].element.append(spec.element);
    }
    for (const side of ['left', 'right'] as const) {
      const active = saved?.active?.[side];
      const st = this.stacks[side];
      st.active = active && st.ids.includes(active) ? active : (st.ids[0] ?? null);
    }
    dock.prepend(this.stacks.left.element);
    dock.append(this.stacks.right.element);
    this.refresh();
  }

  /** Re-applies visibility (after the Layout menu changed). */
  refresh(): void {
    for (const st of Object.values(this.stacks)) {
      const visible = st.ids.filter((id) => this.layout.isVisible(id));
      if (!st.active || !visible.includes(st.active)) st.active = visible[0] ?? null;
      st.tabs.replaceChildren(...visible.map((id) => this.tab(st, id)));
      for (const id of st.ids) {
        const panel = this.panels.get(id)!.element;
        panel.hidden = id !== st.active;
      }
      const empty = visible.length === 0;
      st.element.hidden = empty;
      this.splitters[st.side].hidden = empty;
      // An empty side collapses its grid tracks.
      for (const v of [`--${st.side}-col`, `--${st.side}-gap`]) {
        if (empty) this.dock.style.setProperty(v, '0px');
        else this.dock.style.removeProperty(v);
      }
    }
  }

  /** Shows panel `id` (switching its side's tab to it). */
  show(id: LayoutPart): void {
    const st = this.stackOf(id);
    if (!st) return;
    st.active = id;
    this.save();
    this.refresh();
  }

  private stackOf(id: LayoutPart): Stack | undefined {
    return Object.values(this.stacks).find((s) => s.ids.includes(id));
  }

  private tab(st: Stack, id: LayoutPart): HTMLElement {
    const spec = this.panels.get(id)!;
    const close = h(
      'button',
      {
        type: 'button',
        class: 'panel-close',
        title: `Hide ${spec.title.toLowerCase()} (Layout menu shows it again)`,
        'aria-label': `Hide ${spec.title}`,
        onclick: (e: Event) => {
          e.stopPropagation();
          this.layout.set(id, false);
        },
      },
      icon('close', 12),
    );
    const tab = h(
      'div',
      {
        class: `panel-tab dock-tab${id === st.active ? ' active' : ''}`,
        role: 'tab',
        'data-panel': id,
        title: `${spec.title} · drag to the other side to move it`,
      },
      icon(spec.icon, 14),
      h('span', { text: spec.title }),
      close,
    );
    tab.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('.panel-close')) return;
      e.preventDefault();
      this.dragTab(e, tab, id);
    });
    return tab;
  }

  /** Click: activate the tab; drag: move the panel to the side under the pointer. */
  private dragTab(e: PointerEvent, tab: HTMLElement, id: LayoutPart): void {
    const start = [e.clientX, e.clientY] as const;
    let dragging = false;
    let target: DockSide | null = null;
    tab.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) < DRAG_THRESHOLD)
        return;
      dragging = true;
      document.body.classList.add('dragging-tab');
      target = this.sideAt(ev.clientX, ev.clientY);
      const from = this.stackOf(id)?.side;
      this.showHint(target && target !== from ? target : null);
    };
    const up = (ev: PointerEvent) => {
      tab.removeEventListener('pointermove', move);
      tab.removeEventListener('pointerup', up);
      tab.removeEventListener('pointercancel', up);
      document.body.classList.remove('dragging-tab');
      this.showHint(null);
      if (!dragging) {
        this.show(id);
        return;
      }
      if (ev.type === 'pointerup' && target) this.move(id, target);
    };
    tab.addEventListener('pointermove', move);
    tab.addEventListener('pointerup', up);
    tab.addEventListener('pointercancel', up);
  }

  /** Side a dragged tab would go to at (x, y): over a stack, or near a viewport edge. */
  private sideAt(x: number, y: number): DockSide | null {
    for (const st of Object.values(this.stacks)) {
      if (st.element.hidden) continue;
      const r = st.element.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return st.side;
    }
    const v = this.viewport.getBoundingClientRect();
    if (y < v.top || y > v.bottom) return null;
    if (x >= v.left && x < v.left + v.width * EDGE_ZONE) return 'left';
    if (x <= v.right && x > v.right - v.width * EDGE_ZONE) return 'right';
    return null;
  }

  private showHint(side: DockSide | null): void {
    this.dropHint.hidden = side === null;
    if (!side) return;
    const st = this.stacks[side];
    const v = this.viewport.getBoundingClientRect();
    const r = st.element.hidden
      ? {
          left: side === 'left' ? v.left : v.right - v.width * EDGE_ZONE,
          top: v.top,
          width: v.width * EDGE_ZONE,
          height: v.height,
        }
      : st.element.getBoundingClientRect();
    Object.assign(this.dropHint.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  }

  private move(id: LayoutPart, side: DockSide): void {
    const from = this.stackOf(id);
    if (!from || from.side === side) return;
    from.ids = from.ids.filter((p) => p !== id);
    const to = this.stacks[side];
    to.ids.push(id);
    to.element.append(this.panels.get(id)!.element);
    to.active = id;
    this.save();
    this.refresh();
    this.onChange();
  }

  private load():
    | ({
        [K in LayoutPart]?: DockSide;
      } & { active?: Partial<Record<DockSide, LayoutPart>> })
    | null {
    try {
      const raw = JSON.parse(readStorage(STORAGE_KEY) ?? 'null') as unknown;
      return typeof raw === 'object' && raw !== null ? (raw as never) : null;
    } catch {
      return null;
    }
  }

  private save(): void {
    const out: Record<string, unknown> = {
      active: { left: this.stacks.left.active, right: this.stacks.right.active },
    };
    for (const st of Object.values(this.stacks)) for (const id of st.ids) out[id] = st.side;
    writeStorage(STORAGE_KEY, JSON.stringify(out));
  }
}
