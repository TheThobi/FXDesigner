import { CATEGORY_LABELS, type GeneratorDefinition } from '../engine/generator';
import { generatorsByCategory } from '../generators/registry';
import { clear, h } from './dom';

/** Left sidebar: searchable list of generators grouped by category, with thumbnails. */
export class GeneratorList {
  private readonly items = new Map<string, HTMLElement>();
  private readonly list: HTMLElement;
  private activeId = '';

  constructor(
    readonly element: HTMLElement,
    private readonly onSelect: (id: string) => void,
  ) {
    const search = h('input', {
      type: 'search',
      class: 'search',
      placeholder: 'Search generators…',
      'aria-label': 'Search',
    });
    search.addEventListener('input', () => this.filter(search.value));
    this.list = h('nav', { class: 'generator-list' });
    element.append(search, this.list);
    this.build();
  }

  setActive(id: string): void {
    this.items.get(this.activeId)?.classList.remove('active');
    this.activeId = id;
    this.items.get(id)?.classList.add('active');
  }

  setThumbnail(id: string, url: string): void {
    const img = this.items.get(id)?.querySelector('img');
    if (img) img.src = url;
  }

  private build(): void {
    clear(this.list);
    for (const [category, generators] of generatorsByCategory()) {
      const section = h('section', { class: 'generator-category', 'data-category': category });
      section.append(h('h3', { text: CATEGORY_LABELS[category] }));
      for (const g of generators) section.append(this.item(g));
      this.list.append(section);
    }
  }

  private item(g: GeneratorDefinition): HTMLElement {
    const el = h(
      'button',
      {
        class: `generator-item cat-${g.category}`,
        title: g.description,
        'data-id': g.id,
        onclick: () => this.onSelect(g.id),
      },
      h('img', { class: 'thumb', alt: '', width: 40, height: 40 }),
      h('span', { class: 'name', text: g.name }),
    );
    this.items.set(g.id, el);
    return el;
  }

  private filter(query: string): void {
    const q = query.trim().toLowerCase();
    for (const section of this.list.querySelectorAll<HTMLElement>('.generator-category')) {
      let visible = 0;
      for (const item of section.querySelectorAll<HTMLElement>('.generator-item')) {
        const match =
          !q ||
          (item.textContent ?? '').toLowerCase().includes(q) ||
          (item.title ?? '').toLowerCase().includes(q);
        item.hidden = !match;
        if (match) visible++;
      }
      section.hidden = visible === 0;
    }
  }
}
