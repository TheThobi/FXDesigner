import {
  CATEGORY_LABELS,
  type GeneratorCategory,
  type GeneratorDefinition,
} from '../engine/generator';
import { generatorsByFamily } from '../generators/registry';
import { clear, h } from './dom';
import { icon } from './icons';

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
  private readonly mainThumbs = new Map<string, string>();
  private readonly presetThumbs = new Map<string, readonly string[]>();
  private cycleTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    readonly element: HTMLElement,
    private readonly onSelect: (id: string) => void,
  ) {
    const search = h('input', {
      type: 'search',
      class: 'search',
      placeholder: 'Search generators',
      'aria-label': 'Search generators',
    });
    search.addEventListener('input', () => this.filter(search.value));
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
    element.append(h('div', { class: 'search-box' }, icon('search', 14), search), this.list);
    this.build();
  }

  setActive(id: string): void {
    this.items.get(this.activeId)?.classList.remove('active');
    this.activeId = id;
    const item = this.items.get(id);
    item?.classList.add('active');
    item?.scrollIntoView({ block: 'nearest' });
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
        onclick: () => this.onSelect(g.id),
      },
      h(
        'div',
        { class: 'tile-thumb' },
        h('img', { alt: '', width: 64, height: 64, draggable: false }),
      ),
      h('div', { class: 'tile-stripe' }),
      h('div', { class: 'tile-name', text: g.name }),
      h('div', { class: 'tile-type', text: typeLabel(g.category) }),
    );
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
      section.hidden = visible === 0;
      if (q && visible) section.open = true;
    }
  }
}

function typeLabel(category: GeneratorCategory): string {
  const labels: Partial<Record<GeneratorCategory, string>> = {
    simulation: 'Simulation',
    stylized: 'Stylized FX',
    underworld: 'Underworld FX',
    particle: 'Sprite',
    fire: 'Fire & smoke',
    light: 'Light & energy',
  };
  return labels[category] ?? 'Generator';
}
