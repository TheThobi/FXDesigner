import {
  CATEGORY_LABELS,
  type GeneratorCategory,
  type GeneratorDefinition,
  isOperator,
} from '../engine/generator';
import { generatorsByFamily } from '../generators/registry';
import { openContextMenu } from './ContextMenu';
import { clear, h } from './dom';
import { icon } from './icons';
import { segmentedTabs, type SegmentedTabs } from './Panel';

/** Where generator tiles can be dropped (the viewport). */
export interface TileDropTarget {
  /** The dragged tile is over (x, y) screen pixels. */
  hover(x: number, y: number): void;
  /** Released at (x, y): add generator `id` there (ignored outside the target). */
  drop(id: string, x: number, y: number): void;
  /** The drag ended (dropped or cancelled). */
  end(): void;
}

/** Pointer distance (px) before pressing a tile becomes a drag. */
const TILE_DRAG_THRESHOLD = 6;

/**
 * Content-Browser-like asset grid: one tile per generator (thumbnail, category color stripe,
 * name, type), grouped in collapsible categories, with a search filter.
 */
export class GeneratorList {
  private readonly items = new Map<string, HTMLElement>();
  private readonly list: HTMLElement;
  private activeId = '';
  private readonly visible = new Set<string>();
  private readonly observer: IntersectionObserver;
  /** Called the first time (and every time) a tile scrolls into view. */
  onVisible: ((id: string) => void) | null = null;
  /** Called when the pointer rests on a tile (to provide preset thumbnails). */
  onHover: ((id: string) => void) | null = null;
  /** Tile currently under the pointer. */
  hoveredId: string | null = null;
  /** Receives tiles dragged out of the browser. */
  dropTarget: TileDropTarget | null = null;
  private readonly mainThumbs = new Map<string, string>();
  private readonly presetThumbs = new Map<string, readonly string[]>();
  private cycleTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    readonly element: HTMLElement,
    private readonly onSelect: (id: string) => void,
    /** Double-click: add the generator as a new node. */
    private readonly onAdd: (id: string) => void,
  ) {
    const search = h('input', {
      type: 'search',
      class: 'search',
      placeholder: 'Search generators',
      'aria-label': 'Search generators',
    });
    search.addEventListener('input', () => this.filter(search.value));
    this.search = search;
    this.list = h('nav', { class: 'generator-list' });
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.id;
          if (!id) continue;
          if (entry.isIntersecting) {
            this.visible.add(id);
            this.onVisible?.(id);
          } else {
            this.visible.delete(id);
          }
        }
      },
      { root: this.list, rootMargin: '120px' },
    );
    // Full-width switch: generators (make images) and operators (process / combine them).
    this.tabs = segmentedTabs(
      [
        {
          id: 'generators',
          title: 'Generators',
          icon: 'texture',
          tooltip: 'Nodes that create images',
        },
        {
          id: 'operators',
          title: 'Operators',
          icon: 'nodes',
          tooltip: 'Nodes that transform or combine other nodes (blend, mask, warp, blur…)',
        },
      ],
      (id) => this.showTab(id === 'operators' ? 'operators' : 'generators'),
    );
    element.append(this.tabs.element);
    element.append(h('div', { class: 'search-box' }, icon('search', 14), search), this.list);
    this.build();
    this.showTab('generators');
  }

  private readonly tabs: SegmentedTabs;
  private readonly search: HTMLInputElement;
  private tab: 'generators' | 'operators' = 'generators';

  /**
   * Shows the generator families or the operators. Only the user switches tabs: selecting or
   * deleting nodes never does.
   */
  showTab(tab: 'generators' | 'operators'): void {
    this.tabs.select(tab);
    this.tab = tab;
    this.filter(this.search.value);
    const what = tab === 'generators' ? 'generators' : 'operators';
    this.search.placeholder = `Search ${what}`;
    this.search.setAttribute('aria-label', `Search ${what}`);
  }

  setActive(id: string): void {
    this.items.get(this.activeId)?.classList.remove('active');
    this.activeId = id;
    const item = this.items.get(id);
    item?.classList.add('active');
    if (item && !item.closest<HTMLElement>('.generator-category')?.hidden)
      item.scrollIntoView({ block: 'nearest' });
  }

  /** Ids of the tiles currently in (or near) view. */
  visibleIds(): string[] {
    return [...this.visible];
  }

  setThumbnail(id: string, url: string): void {
    this.mainThumbs.set(id, url);
    if (this.hoveredId === id && this.presetThumbs.has(id)) return;
    const img = this.items.get(id)?.querySelector('img');
    if (img) {
      img.src = url;
      img.classList.add('loaded');
    }
  }

  /** Thumbnails cycled while hovering the tile (its presets). */
  setPresetThumbnails(id: string, urls: readonly string[]): void {
    this.presetThumbs.set(id, urls);
  }

  private startCycle(id: string): void {
    this.stopCycle();
    this.hoveredId = id;
    const el = this.items.get(id);
    const img = el?.querySelector('img');
    // Short delay: brushing over the list shouldn't trigger rendering.
    let i = -1;
    this.cycleTimer = setInterval(() => {
      if (i === -1) this.onHover?.(id);
      const urls = this.presetThumbs.get(id);
      if (!img || !urls?.length) {
        i = 0;
        return;
      }
      i = (i + 1) % urls.length;
      img.src = urls[i]!;
      el?.classList.add('cycling');
    }, 550);
  }

  private stopCycle(): void {
    clearInterval(this.cycleTimer);
    const id = this.hoveredId;
    this.hoveredId = null;
    if (!id) return;
    const el = this.items.get(id);
    el?.classList.remove('cycling');
    const main = this.mainThumbs.get(id);
    const img = el?.querySelector('img');
    if (img && main) img.src = main;
  }

  private build(): void {
    clear(this.list);
    for (const family of generatorsByFamily()) {
      const count = family.sections.reduce((n, s) => n + s.generators.length, 0);
      const section = h('details', {
        class: 'generator-category',
        open: true,
        'data-family': family.id,
      });
      section.append(
        h(
          'summary',
          {},
          h('span', { text: family.label }),
          h('span', { class: 'count', text: String(count) }),
        ),
      );
      const nested = family.sections.length > 1;
      for (const { category, generators } of family.sections) {
        const grid = h('div', { class: 'tile-grid' }, ...generators.map((g) => this.item(g)));
        section.append(
          nested
            ? h(
                'div',
                { class: `generator-subcategory cat-${category}`, 'data-category': category },
                h('div', { class: 'subcategory-title', text: CATEGORY_LABELS[category] }),
                grid,
              )
            : grid,
        );
      }
      this.list.append(section);
    }
  }

  private item(g: GeneratorDefinition): HTMLElement {
    const el = h(
      'button',
      {
        class: `generator-item cat-${g.category}`,
        title: `${g.name}\n${g.description}`,
        'data-id': g.id,
        'data-category': g.category,
      },
      isOperator(g)
        ? h('div', { class: 'tile-thumb operator-glyph', text: OPERATOR_GLYPHS[g.id] ?? 'ƒ' })
        : h(
            'div',
            { class: 'tile-thumb' },
            h('img', { alt: '', width: 64, height: 64, draggable: false }),
          ),
      h('div', { class: 'tile-stripe' }),
      h('div', { class: 'tile-name', text: g.name }),
      h('div', { class: 'tile-type', text: typeLabel(g.category) }),
    );
    // Click swaps the selected node's generator; double-click adds a node (the single click
    // is delayed so a double-click doesn't also swap); drag onto the viewport adds it there.
    let clickTimer: ReturnType<typeof setTimeout> | undefined;
    let dragged = false;
    el.addEventListener('click', (e) => {
      clearTimeout(clickTimer);
      if (dragged) {
        dragged = false;
        return;
      }
      if (e.detail > 1) return;
      clickTimer = setTimeout(() => this.onSelect(g.id), 220);
    });
    el.addEventListener('dblclick', () => {
      clearTimeout(clickTimer);
      this.onAdd(g.id);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, [
        { label: 'Add to the graph', shortcut: 'Dbl-click', run: () => this.onAdd(g.id) },
        { label: 'Replace the selected node', shortcut: 'Click', run: () => this.onSelect(g.id) },
      ]);
    });
    // Pointer-driven drag (not native HTML drag & drop, which other pointer captures and
    // browser extensions can leave in a stuck state): a ghost follows the pointer.
    // The browser must not start its own drag (it would cancel the pointer stream).
    el.addEventListener('dragstart', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); // no text selection / native drag; click and dblclick still fire
      const start = [e.clientX, e.clientY] as const;
      let ghost: HTMLElement | null = null;
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        if (!ghost) {
          if (Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) < TILE_DRAG_THRESHOLD)
            return;
          const thumb = el.querySelector('.tile-thumb')?.cloneNode(true) ?? null;
          ghost = h('div', { class: 'tile-ghost' }, thumb, h('span', { text: g.name }));
          document.body.append(ghost);
          document.body.classList.add('dragging-tile');
          window.getSelection()?.removeAllRanges();
          this.stopCycle();
        }
        ghost.style.transform = `translate(${ev.clientX + 10}px, ${ev.clientY + 10}px)`;
        this.dropTarget?.hover(ev.clientX, ev.clientY);
      };
      const up = (ev: PointerEvent) => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        if (!ghost) return;
        ghost.remove();
        document.body.classList.remove('dragging-tile');
        dragged = true;
        if (ev.type === 'pointerup') this.dropTarget?.drop(g.id, ev.clientX, ev.clientY);
        this.dropTarget?.end();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    el.title += '\nClick: use on the selected node · Double-click or drag: new node';
    this.items.set(g.id, el);
    this.observer.observe(el);
    if (g.presets?.length && g.kind === 'shader') {
      el.addEventListener('pointerenter', () => this.startCycle(g.id));
      el.addEventListener('pointerleave', () => this.stopCycle());
      el.title += `\nHover to preview ${g.presets.length} presets`;
    }
    return el;
  }

  private filter(query: string): void {
    const q = query.trim().toLowerCase();
    const matches = (item: HTMLElement) => !q || (item.title ?? '').toLowerCase().includes(q);
    for (const section of this.list.querySelectorAll<HTMLDetailsElement>('.generator-category')) {
      let visible = 0;
      for (const item of section.querySelectorAll<HTMLElement>('.generator-item')) {
        item.hidden = !matches(item);
        if (!item.hidden) visible++;
      }
      for (const sub of section.querySelectorAll<HTMLElement>('.generator-subcategory')) {
        sub.hidden = sub.querySelector('.generator-item:not([hidden])') === null;
      }
      const inTab = (section.dataset.family === 'operators') === (this.tab === 'operators');
      section.hidden = !inTab || visible === 0;
      if (q && visible) section.open = true;
    }
  }
}

function typeLabel(category: GeneratorCategory): string {
  const labels: Partial<Record<GeneratorCategory, string>> = {
    simulation: 'Simulation',
    operator: 'Operator',
    animation: 'Animation op',
    particle: 'Sprite',
    fire: 'Fire & smoke',
    light: 'Light & magic',
    impact: 'Impact',
    water: 'Water',
    material: 'Material',
  };
  return labels[category] ?? 'Generator';
}

/** Symbols shown on operator tiles (operators have no meaningful thumbnail on their own). */
const OPERATOR_GLYPHS: Readonly<Record<string, string>> = {
  'op-blend': '⧉',
  'op-mask': '◐',
  'op-math': 'π',
  'op-auto-levels': '◩',
  'op-edge-fade': '▒',
  uniform: '1.0',
  'op-level': '◢',
  'op-transform': '⤡',
  'op-warp': '≋',
  'op-blur': '◌',
  'op-slope-blur': '⥂',
  'op-distance': '◎',
  'op-edges': '⬚',
  'op-unpack': 'R G B',
  'op-pack': 'RGBA',
  'op-custom': '{ }',
  'op-hue-shift': 'H°',
  'op-color-cycle': '↻',
  'op-flicker': '✦',
  'op-scroll': '⇅',
  'op-dissolve': '░',
};
