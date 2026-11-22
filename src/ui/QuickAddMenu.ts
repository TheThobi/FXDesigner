import { h } from './dom';
import { icon } from './icons';

export interface QuickAddItem {
  readonly id: string;
  readonly name: string;
  /** Category shown next to the name. */
  readonly label: string;
}

export interface QuickAddOptions {
  /** Screen position (client pixels) of the menu's top-left corner. */
  readonly x: number;
  readonly y: number;
  readonly title: string;
  /** Shown while the search is empty (most used first). */
  readonly suggestions: readonly QuickAddItem[];
  /** Searched by name and category. */
  readonly all: readonly QuickAddItem[];
  readonly onPick: (id: string) => void;
}

const MAX_RESULTS = 12;

let open: (() => void) | null = null;

/**
 * Small floating menu (most used nodes + search) shown when a link is dropped on empty space.
 * Keyboard: type to search, arrows to move, Enter to pick, Escape to close.
 */
export function openQuickAdd(opts: QuickAddOptions): void {
  open?.();
  const search = h('input', {
    type: 'search',
    class: 'search',
    placeholder: 'Search nodes',
    'aria-label': 'Search nodes',
  });
  const list = h('div', { class: 'quick-add-list', role: 'listbox' });
  const menu = h(
    'div',
    { class: 'quick-add', role: 'dialog', 'aria-label': opts.title },
    h('div', { class: 'quick-add-title', text: opts.title }),
    h('div', { class: 'search-box' }, icon('search', 14), search),
    list,
  );
  let items: readonly QuickAddItem[] = [];
  let active = 0;

  const close = () => {
    menu.remove();
    window.removeEventListener('pointerdown', outside, true);
    if (open === close) open = null;
  };
  const pick = (id: string) => {
    close();
    opts.onPick(id);
  };
  const highlight = () => {
    list.querySelectorAll('.quick-add-item').forEach((el, i) => {
      el.classList.toggle('active', i === active);
      if (i === active) el.scrollIntoView({ block: 'nearest' });
    });
  };
  const refresh = () => {
    const q = search.value.trim().toLowerCase();
    items = q
      ? opts.all
          .filter((i) => i.name.toLowerCase().includes(q) || i.label.toLowerCase().includes(q))
          .sort(
            (a, b) =>
              Number(!a.name.toLowerCase().startsWith(q)) -
              Number(!b.name.toLowerCase().startsWith(q)),
          )
          .slice(0, MAX_RESULTS)
      : opts.suggestions;
    active = 0;
    list.replaceChildren(
      ...(q ? [] : [h('div', { class: 'quick-add-section', text: 'Most used' })]),
      ...items.map((item) =>
        h(
          'button',
          {
            class: 'quick-add-item',
            role: 'option',
            onclick: () => pick(item.id),
          },
          h('span', { class: 'quick-add-name', text: item.name }),
          h('span', { class: 'quick-add-label', text: item.label }),
        ),
      ),
      ...(items.length === 0 ? [h('div', { class: 'quick-add-empty', text: 'No match' })] : []),
    );
    highlight();
  };
  const outside = (e: PointerEvent) => {
    if (!menu.contains(e.target as Node)) close();
  };

  search.addEventListener('input', refresh);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      highlight();
    } else if (e.key === 'Enter') {
      const item = items[active];
      if (item) pick(item.id);
    }
  });

  document.body.append(menu);
  refresh();
  // Keep the menu on screen.
  const w = menu.offsetWidth;
  const hgt = menu.offsetHeight;
  menu.style.left = `${Math.max(8, Math.min(opts.x, window.innerWidth - w - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(opts.y, window.innerHeight - hgt - 8))}px`;
  window.addEventListener('pointerdown', outside, true);
  open = close;
  search.focus();
}
