import { h } from './dom';
import { icon, type IconName } from './icons';

export interface LibraryItem {
  readonly id: string;
  readonly name: string;
  readonly updated: number;
  readonly thumb: string | null;
  readonly folder: string | null;
}

export interface LibraryFolder {
  readonly id: string;
  readonly name: string;
}

export interface LibraryActions {
  readonly list: () => readonly LibraryItem[];
  readonly folders: () => readonly LibraryFolder[];
  readonly currentId: () => string | null;
  readonly open: (id: string) => void;
  /** New empty system, in `folder` (null = top level). */
  readonly create: (folder: string | null) => void;
  readonly duplicate: (id: string) => void;
  readonly rename: (id: string) => Promise<void>;
  readonly remove: (id: string) => Promise<void>;
  readonly move: (id: string, folder: string | null) => void;
  readonly createFolder: () => Promise<string | null>;
  readonly renameFolder: (id: string) => Promise<void>;
  readonly removeFolder: (id: string) => Promise<void>;
  /** Account line shown in the header (sync state), or null when signed out. */
  readonly status?: () => string | null;
}

/** Which systems the grid shows: all, the top level, or one folder. */
type View =
  | { readonly kind: 'all' }
  | { readonly kind: 'root' }
  | { readonly kind: 'folder'; readonly id: string };

const DRAG_THRESHOLD = 6;

function when(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

let lastView: View = { kind: 'all' };

/**
 * Library window: folders on the left, the systems of the chosen folder as cards. Click a card
 * to open it; drag a card onto a folder to move it there. New starts an empty system in the
 * current folder. The current system is saved automatically.
 */
export function openLibrary(actions: LibraryActions): void {
  let view: View = lastView;
  const grid = h('div', { class: 'library-grid' });
  const sidebar = h('nav', { class: 'library-folders', 'aria-label': 'Folders' });
  const search = h('input', {
    type: 'search',
    class: 'search',
    placeholder: 'Search systems',
    'aria-label': 'Search systems',
  });
  const status = h('span', { class: 'library-status' });
  const dialog = h('dialog', { class: 'dialog library-dialog' });
  const close = () => dialog.close();

  const smallButton = (iconName: IconName, title: string, run: () => void) =>
    h(
      'button',
      {
        type: 'button',
        class: 'library-btn',
        title,
        'aria-label': title,
        onclick: (e: Event) => {
          e.stopPropagation();
          run();
        },
      },
      icon(iconName, 14),
    );

  const folderOf = (v: View): string | null => (v.kind === 'folder' ? v.id : null);

  const buildSidebar = () => {
    const folders = actions.folders();
    if (view.kind === 'folder' && !folders.some((f) => f.id === (view as { id: string }).id))
      view = { kind: 'all' };
    const count = (f: (i: LibraryItem) => boolean) => actions.list().filter(f).length;
    const row = (v: View, label: string, iconName: IconName, n: number, extra?: HTMLElement[]) => {
      const active =
        v.kind === view.kind && (v.kind !== 'folder' || v.id === (view as { id?: string }).id);
      const el = h(
        'div',
        {
          class: `library-folder${active ? ' active' : ''}`,
          role: 'button',
          tabIndex: 0,
          'data-drop': v.kind === 'all' ? '' : v.kind === 'root' ? 'root' : v.id,
          onclick: () => {
            view = v;
            lastView = v;
            build();
          },
        },
        icon(iconName, 14),
        h('span', { class: 'library-folder-name', text: label }),
        h('span', { class: 'library-folder-count', text: String(n) }),
        ...(extra ?? []),
      );
      return el;
    };
    sidebar.replaceChildren(
      row(
        { kind: 'all' },
        'All systems',
        'grid',
        count(() => true),
      ),
      row(
        { kind: 'root' },
        'Not in a folder',
        'texture',
        count((i) => i.folder === null),
      ),
      h('div', { class: 'library-folders-title', text: 'Folders' }),
      ...folders.map((f) =>
        row(
          { kind: 'folder', id: f.id },
          f.name,
          'open',
          count((i) => i.folder === f.id),
          [
            h(
              'span',
              { class: 'library-folder-actions' },
              smallButton(
                'details',
                'Rename folder',
                () => void actions.renameFolder(f.id).then(build),
              ),
              smallButton(
                'close',
                'Delete folder (its systems are kept)',
                () => void actions.removeFolder(f.id).then(build),
              ),
            ),
          ],
        ),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'library-new-folder',
          onclick: () =>
            void actions.createFolder().then((id) => {
              if (id) view = { kind: 'folder', id };
              build();
            }),
        },
        icon('zoomIn', 14),
        h('span', { text: 'New folder' }),
      ),
    );
  };

  /** Drags a card; dropping it on a folder of the sidebar moves the system there. */
  const dragCard = (e: PointerEvent, card: HTMLElement, item: LibraryItem) => {
    const start = [e.clientX, e.clientY] as const;
    let ghost: HTMLElement | null = null;
    let target: HTMLElement | null = null;
    card.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) < DRAG_THRESHOLD) return;
        ghost = h('div', { class: 'tile-ghost library-ghost' }, h('span', { text: item.name }));
        dialog.append(ghost);
        card.classList.add('dragging');
      }
      ghost.style.transform = `translate(${ev.clientX + 10}px, ${ev.clientY + 10}px)`;
      const over = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>('[data-drop]');
      const valid = over && over.dataset.drop !== '' ? over : null;
      if (valid !== target) {
        target?.classList.remove('drop-over');
        target = valid;
        target?.classList.add('drop-over');
      }
    };
    const up = (ev: PointerEvent) => {
      card.removeEventListener('pointermove', move);
      card.removeEventListener('pointerup', up);
      card.removeEventListener('pointercancel', up);
      card.classList.remove('dragging');
      target?.classList.remove('drop-over');
      if (!ghost) {
        if (ev.type === 'pointerup') {
          close();
          if (item.id !== actions.currentId()) actions.open(item.id);
        }
        return;
      }
      ghost.remove();
      if (ev.type === 'pointerup' && target) {
        const drop = target.dataset.drop!;
        actions.move(item.id, drop === 'root' ? null : drop);
        build();
      }
    };
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerup', up);
    card.addEventListener('pointercancel', up);
  };

  const buildGrid = () => {
    const q = search.value.trim().toLowerCase();
    const current = actions.currentId();
    const items = actions
      .list()
      .filter((i) => (q ? i.name.toLowerCase().includes(q) : true))
      .filter((i) =>
        q || view.kind === 'all'
          ? true
          : view.kind === 'root'
            ? i.folder === null
            : i.folder === view.id,
      );
    grid.replaceChildren(
      h(
        'button',
        {
          type: 'button',
          class: 'library-card library-new',
          onclick: () => {
            close();
            actions.create(folderOf(view));
          },
        },
        h('span', { class: 'library-thumb' }, icon('zoomIn', 28)),
        h('span', { class: 'library-name', text: 'New system' }),
        h('span', { class: 'library-date', text: 'Empty graph' }),
      ),
      ...items.map((item) => {
        const card = h(
          'div',
          {
            class: `library-card${item.id === current ? ' current' : ''}`,
            role: 'button',
            tabIndex: 0,
            title:
              item.id === current
                ? 'Current system'
                : `Open "${item.name}" · drag onto a folder to move it`,
            onkeydown: (e: KeyboardEvent) => {
              if (e.key !== 'Enter') return;
              close();
              if (item.id !== current) actions.open(item.id);
            },
          },
          h(
            'span',
            { class: 'library-thumb' },
            item.thumb ? h('img', { src: item.thumb, alt: '', draggable: false }) : null,
          ),
          h('span', { class: 'library-name', text: item.name }),
          h(
            'span',
            { class: 'library-date' },
            item.id === current ? h('span', { class: 'library-current', text: 'Open' }) : null,
            h('span', { text: when(item.updated) }),
          ),
          h(
            'span',
            { class: 'library-actions' },
            smallButton('details', 'Rename', () => void actions.rename(item.id).then(build)),
            smallButton('layout', 'Duplicate', () => {
              actions.duplicate(item.id);
              build();
            }),
            smallButton('close', 'Delete', () => void actions.remove(item.id).then(build)),
          ),
        );
        card.addEventListener('pointerdown', (e) => {
          if (e.button !== 0 || (e.target as HTMLElement).closest('.library-actions')) return;
          e.preventDefault();
          dragCard(e, card, item);
        });
        return card;
      }),
    );
  };

  const build = () => {
    buildSidebar();
    buildGrid();
    status.textContent = actions.status?.() ?? '';
    status.hidden = status.textContent === '';
  };
  search.addEventListener('input', buildGrid);

  dialog.append(
    h(
      'div',
      { class: 'library-head' },
      h('h2', { text: 'Library' }),
      status,
      h('div', { class: 'search-box' }, icon('search', 14), search),
      h(
        'button',
        {
          type: 'button',
          class: 'panel-close',
          title: 'Close',
          'aria-label': 'Close',
          onclick: close,
        },
        icon('close', 12),
      ),
    ),
    h('div', { class: 'library-body' }, sidebar, grid),
  );
  dialog.addEventListener('close', () => dialog.remove());
  // Clicking the backdrop closes the window.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  document.body.append(dialog);
  build();
  dialog.showModal();
  search.focus();
}
