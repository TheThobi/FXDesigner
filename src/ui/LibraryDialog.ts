import type { PublishState } from '../app/library';
import { openContextMenu, type ContextMenuEntry } from './ContextMenu';
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
  /** Local only, published as is, or edited since it was published. */
  readonly publishState: (id: string) => PublishState;
  /** Community actions on a library system. */
  readonly community: {
    /** First publication, or an update when it is published. */
    readonly publish: (id: string) => void;
    readonly view: (id: string) => void;
    /** Name, category, tags, description of the community page. */
    readonly edit: (id: string) => void;
    /** Back to local only (stays online). */
    readonly unlink: (id: string) => void;
  };
}

/** Which systems the window lists. */
type LibraryFilter = 'all' | 'local' | 'published';
const FILTERS: readonly { id: LibraryFilter; label: string; title: string }[] = [
  { id: 'all', label: 'All', title: 'Every system' },
  { id: 'local', label: 'Local', title: 'Systems only in your library' },
  { id: 'published', label: 'Published', title: 'Systems you published in the community' },
];
let lastFilter: LibraryFilter = 'all';

const DRAG_THRESHOLD = 6;

function when(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Corner marker of a published system: up to date, or with unpublished changes. */
function publishBadge(state: PublishState): HTMLElement | null {
  if (state === 'local') return null;
  return h(
    'span',
    {
      class: `library-publish ${state}`,
      title:
        state === 'modified'
          ? 'Published, with local changes not published yet'
          : 'Published in the community, up to date',
    },
    icon('globe', 11),
    state === 'modified' ? 'Modified' : 'Published',
  );
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
  let filter: LibraryFilter = lastFilter;
  const states = new Map<string, PublishState>();
  const stateOf = (id: string) => {
    let s = states.get(id);
    if (!s) states.set(id, (s = actions.publishState(id)));
    return s;
  };
  const shown = (item: LibraryItem) =>
    filter === 'all' || (filter === 'local') === (stateOf(item.id) === 'local');
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

  /** Right-click menu inside the window (the page under a modal dialog is inert). */
  const menu = (e: MouseEvent, entries: readonly ContextMenuEntry[]) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e.clientX, e.clientY, entries, dialog);
  };
  const openSystem = (item: LibraryItem) => {
    close();
    if (item.id !== actions.currentId()) actions.open(item.id);
  };
  const newFolder = () => void actions.createFolder().then(() => build());
  const newSystem = () => {
    close();
    actions.create(folder);
  };

  /** Community part of a system's menu, by its publication state. */
  const communityEntries = (id: string): ContextMenuEntry[] => {
    const c = actions.community;
    const state = stateOf(id);
    if (state === 'local')
      return [{ label: 'Publish to the community…', run: () => (close(), c.publish(id)) }];
    return [
      ...(state === 'modified'
        ? [{ label: 'Publish update…', run: () => (close(), c.publish(id)) }]
        : [{ label: 'Published · up to date', disabled: true, run: () => undefined }]),
      { label: 'View in the community', run: () => (close(), c.view(id)) },
      { label: 'Edit community page…', run: () => (close(), c.edit(id)) },
      {
        label: 'Make local only…',
        run: () => {
          void Promise.resolve(c.unlink(id)).then(() => {
            states.clear();
            build();
          });
        },
      },
    ];
  };

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
        ? [
            h('span', { class: 'library-sep', text: '/' }),
            h('span', { class: 'library-crumb current', text: current.name }),
          ]
        : []),
      h(
        'div',
        { class: 'library-filter', role: 'group', 'aria-label': 'Show' },
        ...FILTERS.map((f) =>
          h('button', {
            type: 'button',
            class: `library-filter-btn${f.id === filter ? ' active' : ''}`,
            text: f.label,
            title: f.title,
            'aria-pressed': String(f.id === filter),
            onclick: () => {
              filter = f.id;
              lastFilter = f.id;
              build();
            },
          }),
        ),
      ),
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
        oncontextmenu: (e: MouseEvent) =>
          menu(e, [
            { label: 'Open', run: () => go(f.id) },
            { label: 'Rename…', run: () => void actions.renameFolder(f.id).then(build) },
            null,
            {
              label: 'Delete folder',
              run: () => void actions.removeFolder(f.id).then(build),
            },
          ]),
      },
      h('span', { class: 'library-thumb library-folder-thumb' }, icon('open', 40)),
      h('span', { class: 'library-name', text: f.name }),
      h('span', { class: 'library-date', text: `${count} system${count === 1 ? '' : 's'}` }),
      h(
        'span',
        { class: 'library-actions' },
        smallButton('details', 'Rename folder', () => void actions.renameFolder(f.id).then(build)),
        smallButton(
          'close',
          'Delete folder (its systems are kept)',
          () => void actions.removeFolder(f.id).then(build),
        ),
      ),
    );

  const systemCard = (item: LibraryItem, current: string | null, showFolder: boolean) => {
    const state = stateOf(item.id);
    const folderName =
      showFolder && item.folder
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
          if (e.key !== 'Enter' || e.target !== e.currentTarget) return;
          close();
          if (item.id !== current) actions.open(item.id);
        },
      },
      h(
        'span',
        { class: 'library-thumb' },
        item.thumb ? h('img', { src: item.thumb, alt: '', draggable: false }) : null,
        publishBadge(state),
      ),
      h('span', { class: 'library-name', text: item.name }),
      h(
        'span',
        { class: 'library-date' },
        item.id === current ? h('span', { class: 'library-current', text: 'Open' }) : null,
        h('span', {
          text: folderName ? `${folderName} · ${when(item.updated)}` : when(item.updated),
        }),
      ),
      state === 'local'
        ? h('button', {
            type: 'button',
            class: 'btn btn-small library-quick-publish',
            text: 'Publish',
            'aria-label': `Publish ${item.name}`,
            onclick: () => {
              close();
              actions.community.publish(item.id);
            },
          })
        : null,
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
      if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      dragCard(e, card, item);
    });
    card.addEventListener('contextmenu', (e) => {
      const folders = actions.folders();
      const move = (target: string | null) => {
        actions.move(item.id, target);
        build();
      };
      menu(e, [
        {
          label: item.id === current ? 'Current system' : 'Open',
          disabled: item.id === current,
          run: () => openSystem(item),
        },
        { label: 'Rename…', run: () => void actions.rename(item.id).then(build) },
        {
          label: 'Duplicate',
          run: () => {
            actions.duplicate(item.id);
            build();
          },
        },
        null,
        ...communityEntries(item.id),
        null,
        ...(item.folder ? [{ label: 'Move out of the folder', run: () => move(null) }] : []),
        ...folders
          .filter((f) => f.id !== item.folder)
          .map((f) => ({ label: `Move to "${f.name}"`, run: () => move(f.id) })),
        null,
        { label: 'Delete', run: () => void actions.remove(item.id).then(build) },
      ]);
    });
    return card;
  };

  const buildGrid = () => {
    const q = search.value.trim().toLowerCase();
    const current = actions.currentId();
    const all = actions.list();
    if (q) {
      // Search: every system, wherever it is.
      const hits = all.filter((i) => i.name.toLowerCase().includes(q) && shown(i));
      grid.replaceChildren(
        ...hits.map((i) => systemCard(i, current, true)),
        ...(hits.length ? [] : [h('p', { class: 'library-empty', text: 'No system found' })]),
      );
      return;
    }
    const folders = folder ? [] : actions.folders();
    const systems = all.filter((i) => i.folder === folder && shown(i));
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

  // Right-click on the empty part of the window: create things here.
  grid.addEventListener('contextmenu', (e) => {
    if ((e.target as HTMLElement).closest('.library-card')) return;
    menu(e, [
      { label: 'New system', run: newSystem },
      ...(folder === null ? [{ label: 'New folder…', run: newFolder }] : []),
      ...(folder !== null ? [{ label: 'Back to the library', run: () => go(null) }] : []),
    ]);
  });

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
