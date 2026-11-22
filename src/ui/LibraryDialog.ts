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

const DRAG_THRESHOLD = 6;

function when(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Folder shown when the window opens again (null = the top level). */
let lastFolder: string | null = null;

/**
 * Library window, like a file explorer: the top level shows the folders then the systems
 * outside any folder; click a folder to open it, Back (or the "Library" crumb) to go up.
 * Click a system to open it; drag it onto a folder (or onto "Library" to take it out of its
 * folder). Search looks through every system. The current system is saved automatically.
 */
export function openLibrary(actions: LibraryActions): void {
  let folder: string | null = lastFolder;
  const grid = h('div', { class: 'library-grid' });
  const path = h('div', { class: 'library-path' });
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
      icon(iconName, 12),
    );

  const go = (id: string | null) => {
    folder = id;
    lastFolder = id;
    search.value = '';
    build();
  };

  /** Back button and breadcrumb ("Library" is a drop target: out of the folder). */
  const buildPath = () => {
    const current = folder ? actions.folders().find((f) => f.id === folder) : undefined;
    if (folder && !current) folder = null;
    const root = h('button', {
      type: 'button',
      class: 'library-crumb',
      'data-drop': 'root',
      text: 'Library',
      onclick: () => go(null),
    });
    path.replaceChildren(
      h(
        'button',
        {
          type: 'button',
          class: 'library-back',
          title: 'Back to the library',
          'aria-label': 'Back',
          disabled: !current,
          onclick: () => go(null),
        },
        icon('chevronDown', 16),
      ),
      root,
      ...(current
        ? [h('span', { class: 'library-sep', text: '/' }), h('span', { class: 'library-crumb current', text: current.name })]
        : []),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-small library-new-folder',
          hidden: current !== undefined,
          onclick: () =>
            void actions.createFolder().then(() => {
              build();
            }),
        },
        icon('zoomIn', 12),
        'New folder',
      ),
    );
  };

  /** Drags a card; dropping it on a folder (or on "Library") moves the system there. */
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
      if (over !== target) {
        target?.classList.remove('drop-over');
        target = over ?? null;
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

  const folderCard = (f: LibraryFolder, count: number) =>
    h(
      'div',
      {
        class: 'library-card library-folder-card',
        role: 'button',
        tabIndex: 0,
        'data-drop': f.id,
        title: `Open "${f.name}" · drop systems here to move them in`,
        onclick: () => go(f.id),
        onkeydown: (e: KeyboardEvent) => {
          if (e.key === 'Enter') go(f.id);
        },
      },
      h('span', { class: 'library-thumb library-folder-thumb' }, icon('open', 40)),
      h('span', { class: 'library-name', text: f.name }),
      h('span', { class: 'library-date', text: `${count} system${count === 1 ? '' : 's'}` }),
      h(
        'span',
        { class: 'library-actions' },
        smallButton('details', 'Rename folder', () => void actions.renameFolder(f.id).then(build)),
        smallButton('close', 'Delete folder (its systems are kept)', () =>
          void actions.removeFolder(f.id).then(build),
        ),
      ),
    );

  const systemCard = (item: LibraryItem, current: string | null, showFolder: boolean) => {
    const folderName = showFolder && item.folder
      ? actions.folders().find((f) => f.id === item.folder)?.name
      : undefined;
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
        h('span', { text: folderName ? `${folderName} · ${when(item.updated)}` : when(item.updated) }),
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
  };

  const buildGrid = () => {
    const q = search.value.trim().toLowerCase();
    const current = actions.currentId();
    const all = actions.list();
    if (q) {
      // Search: every system, wherever it is.
      const hits = all.filter((i) => i.name.toLowerCase().includes(q));
      grid.replaceChildren(
        ...hits.map((i) => systemCard(i, current, true)),
        ...(hits.length ? [] : [h('p', { class: 'library-empty', text: 'No system found' })]),
      );
      return;
    }
    const folders = folder ? [] : actions.folders();
    const systems = all.filter((i) => i.folder === folder);
    grid.replaceChildren(
      h(
        'button',
        {
          type: 'button',
          class: 'library-card library-new',
          onclick: () => {
            close();
            actions.create(folder);
          },
        },
        h('span', { class: 'library-thumb' }, icon('zoomIn', 28)),
        h('span', { class: 'library-name', text: 'New system' }),
        h('span', { class: 'library-date', text: 'Empty graph' }),
      ),
      ...folders.map((f) => folderCard(f, all.filter((i) => i.folder === f.id).length)),
      ...systems.map((i) => systemCard(i, current, false)),
    );
  };

  const build = () => {
    buildPath();
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
    path,
    grid,
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
