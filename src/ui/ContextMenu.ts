import { h } from './dom';
import { icon, type IconName } from './icons';

export interface ContextMenuItem {
  readonly label: string;
  readonly run: () => void;
  readonly icon?: IconName;
  readonly shortcut?: string;
  readonly disabled?: boolean;
}

/** `null` draws a separator. */
export type ContextMenuEntry = ContextMenuItem | null;

let closeOpen: (() => void) | null = null;

/**
 * Right-click menu at a screen point (kept inside the window). Closes on pick, Escape, outside
 * click, scroll or blur. Inside a modal dialog, pass the dialog as `container` (the page
 * below it is inert).
 */
export function openContextMenu(
  x: number,
  y: number,
  entries: readonly ContextMenuEntry[],
  container: HTMLElement = document.body,
): void {
  closeOpen?.();
  const menu = h('div', { class: 'menu-panel context-menu', role: 'menu' });
  const close = () => {
    menu.remove();
    window.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('blur', close);
    window.removeEventListener('wheel', close, true);
    if (closeOpen === close) closeOpen = null;
  };
  const outside = (e: PointerEvent) => {
    if (!menu.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    close();
  };
  // Consecutive separators (or one at an end) collapse.
  const rows: HTMLElement[] = [];
  for (const entry of entries) {
    if (entry === null) {
      if (rows.length && !rows[rows.length - 1]!.classList.contains('menu-sep'))
        rows.push(h('div', { class: 'menu-sep' }));
      continue;
    }
    rows.push(
      h(
        'button',
        {
          type: 'button',
          class: 'menu-item',
          role: 'menuitem',
          disabled: entry.disabled === true,
          onclick: () => {
            close();
            entry.run();
          },
        },
        h('span', { class: 'menu-check' }, entry.icon ? icon(entry.icon, 14) : null),
        h('span', { text: entry.label }),
        entry.shortcut ? h('kbd', { text: entry.shortcut }) : null,
      ),
    );
  }
  while (rows.length && rows[rows.length - 1]!.classList.contains('menu-sep')) rows.pop();
  menu.append(...rows);
  menu.addEventListener('contextmenu', (e) => e.preventDefault());
  container.append(menu);
  const r = menu.getBoundingClientRect();
  const left = Math.max(4, Math.min(x, window.innerWidth - r.width - 4));
  const top = Math.max(4, Math.min(y, window.innerHeight - r.height - 4));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  window.addEventListener('pointerdown', outside, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('blur', close);
  window.addEventListener('wheel', close, true);
  closeOpen = close;
}
