import { readStorage, writeStorage } from '../util/storage';
import { h } from './dom';
import { icon, type IconName } from './icons';
import type { Layout, LayoutPart } from './Layout';

export type PanelId = 'browser' | 'details' | 'viewport' | 'workspace' | 'preview3d';

export interface DockPanelSpec {
  readonly id: PanelId;
  readonly title: string;
  readonly icon: IconName;
  readonly element: HTMLElement;
}

/** The dock layout: splits (rows / columns, with relative sizes) of tab stacks. */
type DockNode = Split | Stack;

interface Split {
  readonly kind: 'split';
  dir: 'row' | 'column';
  children: DockNode[];
  /** Relative sizes (flex-grow) of the children. */
  sizes: number[];
}

interface Stack {
  readonly kind: 'stack';
  panels: PanelId[];
  active: PanelId;
}

type Zone = 'center' | 'left' | 'right' | 'top' | 'bottom';

const STORAGE_KEY = 'ptm.ui.dock.v2';
const DRAG_THRESHOLD = 6;
/** Edge band (fraction of a stack) that splits instead of stacking. */
const EDGE = 0.28;
const PANELS: readonly PanelId[] = ['browser', 'details', 'viewport', 'workspace', 'preview3d'];

function defaultLayout(): Split {
  return {
    kind: 'split',
    dir: 'row',
    children: [
      { kind: 'stack', panels: ['browser'], active: 'browser' },
      { kind: 'stack', panels: ['viewport'], active: 'viewport' },
      { kind: 'stack', panels: ['details', 'workspace', 'preview3d'], active: 'details' },
    ],
    sizes: [0.2, 0.55, 0.25],
  };
}

/** Validates a stored layout (every panel at most once, viewport present). */
export function parseDockLayout(raw: unknown): Split | null {
  const seen = new Set<PanelId>();
  const node = (n: unknown): DockNode | null => {
    const o = n as {
      kind?: unknown;
      panels?: unknown;
      active?: unknown;
      dir?: unknown;
      children?: unknown;
      sizes?: unknown[];
    } | null;
    if (typeof o !== 'object' || o === null) return null;
    if (o.kind === 'stack' && Array.isArray(o.panels)) {
      const panels = (o.panels as unknown[]).filter(
        (p): p is PanelId => PANELS.includes(p as PanelId) && !seen.has(p as PanelId),
      );
      panels.forEach((p) => seen.add(p));
      if (!panels.length) return null;
      const active = panels.includes(o.active as PanelId) ? (o.active as PanelId) : panels[0]!;
      return { kind: 'stack', panels, active };
    }
    if (
      o.kind === 'split' &&
      (o.dir === 'row' || o.dir === 'column') &&
      Array.isArray(o.children)
    ) {
      const pairs = (o.children as unknown[])
        .map((c, i) => [node(c), Math.max(0.05, Number(o.sizes?.[i]) || 1)] as const)
        .filter((p): p is readonly [DockNode, number] => p[0] !== null);
      if (!pairs.length) return null;
      return {
        kind: 'split',
        dir: o.dir,
        children: pairs.map((p) => p[0]),
        sizes: pairs.map((p) => p[1]),
      };
    }
    return null;
  };
  const root = node(raw);
  if (!root || !seen.has('viewport')) return null;
  return root.kind === 'split' ? root : { kind: 'split', dir: 'row', children: [root], sizes: [1] };
}

/**
 * Unreal-like docking: the editor is a tree of splits and tab stacks. Drag any tab onto a
 * panel: its center stacks the tab there, its edges split the panel (left, right, top,
 * bottom). Splitters resize neighbours. Panels hidden from the Layout menu stay in the tree
 * (only not drawn: the viewport takes the room), so they come back at the same place and
 * size, in any order. The arrangement is persisted.
 */
export class DockManager {
  private root: Split;
  private readonly specs = new Map<PanelId, DockPanelSpec>();
  private readonly hint: HTMLElement;

  constructor(
    private readonly container: HTMLElement,
    specs: readonly DockPanelSpec[],
    private readonly layout: Layout,
    /** The arrangement changed (sizes of the viewport may have changed). */
    private readonly onChange: () => void,
  ) {
    for (const s of specs) this.specs.set(s.id, s);
    let saved: unknown;
    try {
      saved = JSON.parse(readStorage(STORAGE_KEY) ?? 'null');
    } catch {
      saved = null;
    }
    this.root = parseDockLayout(saved) ?? defaultLayout();
    this.hint = h('div', { class: 'dock-drop-hint', hidden: true });
    document.body.append(this.hint);
    this.refresh();
  }

  /** Re-applies the Layout menu (hidden panels) and redraws. */
  refresh(): void {
    // Layouts saved by older versions dropped hidden panels: put them back by the viewport.
    for (const id of PANELS) {
      if (id === 'workspace' || id === 'preview3d') continue;
      if (!this.find(id))
        this.insertBeside(this.find('viewport')!, id, id === 'browser' ? 'left' : 'right');
    }
    if (!this.find('workspace')) this.find('details')?.panels.push('workspace');
    if (!this.find('preview3d')) this.find('details')?.panels.push('preview3d');
    this.render();
  }

  /** Panels hidden from the Layout menu (the viewport never is). */
  private visible(id: PanelId): boolean {
    if (id === 'workspace') return this.layout.isVisible('details');
    return id === 'viewport' || this.layout.isVisible(id as LayoutPart);
  }

  /** Whether anything of `node` is drawn. */
  private shown(node: DockNode): boolean {
    return node.kind === 'stack'
      ? node.panels.some((p) => this.visible(p))
      : node.children.some((c) => this.shown(c));
  }

  /** Brings panel `id` to the front of its tab stack. */
  activate(id: PanelId): void {
    const stack = this.find(id);
    if (!stack || stack.active === id) return;
    stack.active = id;
    this.save();
    this.render();
  }

  /** Back to the default arrangement (Layout → Reset). */
  reset(): void {
    this.root = defaultLayout();
    this.save();
    this.refresh();
  }

  // ---- Tree helpers ------------------------------------------------------------------------

  private find(id: PanelId, node: DockNode = this.root): Stack | null {
    if (node.kind === 'stack') return node.panels.includes(id) ? node : null;
    for (const c of node.children) {
      const f = this.find(id, c);
      if (f) return f;
    }
    return null;
  }

  private parentOf(target: DockNode, node: Split = this.root): Split | null {
    for (const c of node.children) {
      if (c === target) return node;
      if (c.kind === 'split') {
        const p = this.parentOf(target, c);
        if (p) return p;
      }
    }
    return null;
  }

  private removePanel(id: PanelId): void {
    const stack = this.find(id);
    if (!stack) return;
    stack.panels = stack.panels.filter((p) => p !== id);
    if (stack.panels.length) {
      if (stack.active === id) stack.active = stack.panels[0]!;
      return;
    }
    this.removeNode(stack);
  }

  /** Removes `node` from its parent, collapsing splits left with one child. */
  private removeNode(node: DockNode): void {
    const parent = this.parentOf(node);
    if (!parent) return;
    const i = parent.children.indexOf(node);
    parent.children.splice(i, 1);
    parent.sizes.splice(i, 1);
    if (parent.sizes.length) normalize(parent);
    if (parent.children.length !== 1) return;
    const remaining = parent.children[0]!;
    if (parent === this.root) {
      if (remaining.kind === 'split') this.root = remaining;
      return;
    }
    const grand = this.parentOf(parent)!;
    grand.children[grand.children.indexOf(parent)] = remaining;
  }

  /** Puts panel `id` in a new stack on `side` of `target` (half of the target's room). */
  private insertBeside(target: Stack, id: PanelId, side: Exclude<Zone, 'center'>): void {
    const dir = side === 'left' || side === 'right' ? 'row' : 'column';
    const fresh: Stack = { kind: 'stack', panels: [id], active: id };
    const parent = this.parentOf(target) ?? this.root;
    const index = parent.children.indexOf(target);
    const after = side === 'right' || side === 'bottom';
    if (parent.dir === dir && index >= 0) {
      const size = parent.sizes[index]! / 2;
      parent.sizes[index] = size;
      parent.children.splice(index + (after ? 1 : 0), 0, fresh);
      parent.sizes.splice(index + (after ? 1 : 0), 0, size);
      normalize(parent);
      return;
    }
    // Wrap the target in a split of the other direction.
    const share = 0.35;
    const wrap: Split = {
      kind: 'split',
      dir,
      children: after ? [target, fresh] : [fresh, target],
      sizes: after ? [1 - share, share] : [share, 1 - share],
    };
    if (index >= 0) parent.children[index] = wrap;
  }

  /** Drops panel `id` on `zone` of `target`. */
  private dock(id: PanelId, target: Stack, zone: Zone): void {
    if (zone === 'center') {
      if (target.panels.includes(id)) return;
      this.removePanel(id);
      target.panels.push(id);
      target.active = id;
    } else {
      if (target.panels.length === 1 && target.panels[0] === id) return;
      this.removePanel(id);
      this.insertBeside(target, id, zone);
    }
    this.save();
    this.render();
    this.onChange();
  }

  private save(): void {
    writeStorage(STORAGE_KEY, JSON.stringify(this.root));
  }

  // ---- Rendering ---------------------------------------------------------------------------

  private render(): void {
    // Panels are moved, never recreated (the viewport keeps its WebGL canvas).
    this.container.replaceChildren(this.renderNode(this.root));
    window.dispatchEvent(new Event('resize'));
  }

  private renderNode(node: DockNode): HTMLElement {
    if (node.kind === 'stack') return this.renderStack(node);
    const el = h('div', { class: `dock-split ${node.dir}` });
    // Keep saved sizes intact; only the viewport receives hidden siblings' space.
    const viewport = node.children.findIndex((child) => this.find('viewport', child));
    const released = node.children.reduce(
      (sum, child, i) => sum + (this.shown(child) ? 0 : (node.sizes[i] ?? 1)),
      0,
    );
    let prev: { index: number; el: HTMLElement } | null = null;
    node.children.forEach((child, i) => {
      if (!this.shown(child)) return;
      const childEl = this.renderNode(child);
      childEl.style.flex = `${(node.sizes[i] ?? 1) + (i === viewport ? released : 0)} 1 0`;
      if (prev) el.append(this.splitter(node, [prev.index, i], [prev.el, childEl], el));
      el.append(childEl);
      prev = { index: i, el: childEl };
    });
    return el;
  }

  private renderStack(stack: Stack): HTMLElement {
    const tabs = h('div', { class: 'panel-tabs dock-tabs', role: 'tablist' });
    const body = h('div', { class: 'dock-body' });
    const el = h('div', { class: 'dock-stack' }, tabs, body);
    const panels = stack.panels.filter((p) => this.visible(p));
    const active = panels.includes(stack.active) ? stack.active : panels[0];
    for (const id of panels) {
      const spec = this.specs.get(id)!;
      tabs.append(this.tab(stack, spec, active));
      spec.element.hidden = id !== active;
      body.append(spec.element);
    }
    stacks.set(el, stack);
    return el;
  }

  private tab(stack: Stack, spec: DockPanelSpec, active: PanelId | undefined): HTMLElement {
    const closable = spec.id !== 'viewport' && spec.id !== 'workspace';
    const tab = h(
      'div',
      {
        class: `panel-tab dock-tab${spec.id === active ? ' active' : ''}`,
        role: 'tab',
        'aria-selected': String(spec.id === active),
        'data-panel': spec.id,
        title: `${spec.title} · drag onto a panel: center to stack, edges to split`,
      },
      icon(spec.icon, 14),
      h('span', { text: spec.title }),
      closable
        ? h(
            'button',
            {
              type: 'button',
              class: 'panel-close',
              title: `Hide ${spec.title.toLowerCase()} (the Layout menu shows it again)`,
              'aria-label': `Hide ${spec.title}`,
              onclick: (e: Event) => {
                e.stopPropagation();
                this.layout.set(spec.id as LayoutPart, false);
              },
            },
            icon('close', 12),
          )
        : null,
    );
    tab.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('.panel-close')) return;
      e.preventDefault();
      this.dragTab(e, tab, stack, spec.id);
    });
    return tab;
  }

  /** Drag between two drawn children of a split (`pair`: their indices): moves their boundary. */
  private splitter(
    split: Split,
    pair: readonly [number, number],
    els: readonly [HTMLElement, HTMLElement],
    container: HTMLElement,
  ): HTMLElement {
    const el = h('div', {
      class: `dock-splitter ${split.dir}`,
      role: 'separator',
      title: 'Drag to resize',
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      const horizontal = split.dir === 'row';
      const rect = container.getBoundingClientRect();
      const total = (horizontal ? rect.width : rect.height) || 1;
      const sum = split.sizes.reduce((a, b) => a + b, 0);
      const start = horizontal ? e.clientX : e.clientY;
      const [ia, ib] = pair;
      const a0 = split.sizes[ia]!;
      const b0 = split.sizes[ib]!;
      const displayedA = parseFloat(els[0].style.flexGrow);
      const displayedB = parseFloat(els[1].style.flexGrow);
      // Sizes are relative to the drawn children only.
      const drawn = [...container.children].filter(
        (c): c is HTMLElement => !c.classList.contains('dock-splitter'),
      );
      const shownSum =
        drawn.reduce((acc, c) => acc + (parseFloat(c.style.flexGrow) || 0), 0) || sum;
      const min = (140 / total) * shownSum;
      const move = (ev: PointerEvent) => {
        const delta = (((horizontal ? ev.clientX : ev.clientY) - start) / total) * shownSum;
        // Resize the saved shares by the same delta, without persisting borrowed space.
        const lower = Math.max(min - displayedA, 0.05 * sum - a0);
        const upper = Math.min(displayedB - min, b0 - 0.05 * sum);
        const change = Math.max(lower, Math.min(upper, delta));
        split.sizes[ia] = a0 + change;
        split.sizes[ib] = b0 - change;
        els[0].style.flex = `${displayedA + change} 1 0`;
        els[1].style.flex = `${displayedB - change} 1 0`;
        window.dispatchEvent(new Event('resize'));
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        el.classList.remove('dragging');
        this.save();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    return el;
  }

  /** Click: activate the tab. Drag: dock the panel on the zone under the pointer. */
  private dragTab(e: PointerEvent, tab: HTMLElement, stack: Stack, id: PanelId): void {
    const start = [e.clientX, e.clientY] as const;
    let dragging = false;
    let target: DropTarget | null = null;
    tab.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) < DRAG_THRESHOLD)
        return;
      dragging = true;
      document.body.classList.add('dragging-tab');
      target = this.zoneAt(ev.clientX, ev.clientY);
      this.showHint(target);
    };
    const up = (ev: PointerEvent) => {
      tab.removeEventListener('pointermove', move);
      tab.removeEventListener('pointerup', up);
      tab.removeEventListener('pointercancel', up);
      document.body.classList.remove('dragging-tab');
      this.hint.hidden = true;
      if (!dragging) {
        stack.active = id;
        this.save();
        this.render();
        return;
      }
      const t = target as DropTarget | null;
      if (ev.type === 'pointerup' && t) this.dock(id, t.stack, t.zone);
    };
    tab.addEventListener('pointermove', move);
    tab.addEventListener('pointerup', up);
    tab.addEventListener('pointercancel', up);
  }

  private zoneAt(x: number, y: number): DropTarget | null {
    const el = document
      .elementsFromPoint(x, y)
      .find((e): e is HTMLElement => e instanceof HTMLElement && stacks.has(e));
    const stack = el ? stacks.get(el) : undefined;
    if (!el || !stack) return null;
    const r = el.getBoundingClientRect();
    const fx = (x - r.left) / r.width;
    const fy = (y - r.top) / r.height;
    const edges: [Zone, number][] = [
      ['left', fx],
      ['right', 1 - fx],
      ['top', fy],
      ['bottom', 1 - fy],
    ];
    const [zone, d] = edges.sort((a, b) => a[1] - b[1])[0]!;
    return { stack, zone: d < EDGE ? zone : 'center', rect: r };
  }

  private showHint(t: DropTarget | null): void {
    this.hint.hidden = t === null;
    if (!t) return;
    const r = t.rect;
    const box = { left: r.left, top: r.top, width: r.width, height: r.height };
    if (t.zone === 'left' || t.zone === 'right') box.width /= 2;
    if (t.zone === 'right') box.left += r.width / 2;
    if (t.zone === 'top' || t.zone === 'bottom') box.height /= 2;
    if (t.zone === 'bottom') box.top += r.height / 2;
    Object.assign(this.hint.style, {
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    });
    this.hint.dataset.zone = t.zone;
  }
}

/** Sizes sum to 1, none below 5 % (no panel ends up crushed). */
function normalize(split: Split): void {
  const min = 0.05;
  let sum = split.sizes.reduce((a, b) => a + b, 0) || 1;
  split.sizes = split.sizes.map((s) => Math.max(min, s / sum));
  sum = split.sizes.reduce((a, b) => a + b, 0);
  split.sizes = split.sizes.map((s) => s / sum);
}

interface DropTarget {
  readonly stack: Stack;
  readonly zone: Zone;
  readonly rect: DOMRect;
}

/** Stack of each rendered stack element (drop targets). */
const stacks = new WeakMap<HTMLElement, Stack>();
