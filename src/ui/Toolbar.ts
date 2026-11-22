import type { PublishState } from '../app/library';
import { h } from './dom';
import { icon, type IconName } from './icons';
import { LAYOUT_PARTS, type Layout } from './Layout';
import { attachPopover } from './popover';

export interface ToolbarState {
  /** Name of the current system (library). */
  readonly systemName: string;
  /** Community state of the current system (badge next to its name). */
  readonly publishState: PublishState;
  readonly viewTiles: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface ToolbarActions {
  setViewTiles(n: number): void;
  undo(): void;
  redo(): void;
  /** Opens the export window (every export kind). */
  openExport(): void;
  openLibrary(): void;
  /** Systems shared by everyone (browse, subscribe, publish). */
  openCommunity(): void;
  newSystem(): void;
  renameSystem(): void;
  saveFile(): void;
  loadFile(): void;
  /** Downloads every system of the library as one file. */
  saveLibrary(): void;
  /** Adds the systems of a library file. */
  loadLibrary(): void;
}

function toolButton(
  iconName: IconName,
  label: string,
  title: string,
  onclick: () => void,
  extraClass = '',
): HTMLButtonElement {
  return h(
    'button',
    { class: `tool-btn ${extraClass}`.trim(), title, onclick },
    icon(iconName, 18),
    label ? h('span', { class: 'label', text: label }) : null,
  );
}

/**
 * Main toolbar (file, history, export) and the viewport overlay toolbar (tiling preview).
 * Playback controls live in the timeline. Seed and export size live in the Output tab.
 */
export class Toolbar {
  private readonly tilesSelect: HTMLSelectElement;
  private readonly systemLabel: HTMLButtonElement;
  /** Filled by the app with the account control (right side, before Layout). */
  readonly accountSlot: HTMLElement;
  private readonly publishBadge: HTMLButtonElement;
  private state: ToolbarState = {
    systemName: '',
    publishState: 'local',
    viewTiles: 1,
    canUndo: false,
    canRedo: false,
  };

  constructor(
    mainBar: HTMLElement,
    viewportBar: HTMLElement,
    actions: ToolbarActions,
    layout: Layout,
  ) {
    this.tilesSelect = h(
      'select',
      {
        class: 'vp-select',
        'aria-label': 'Tiling preview',
        title: 'Preview tiling (checks seamlessness)',
      },
      ...[1, 2, 3].map((n) =>
        h('option', { value: String(n), text: n === 1 ? 'Single' : `Tiled ${n}×${n}` }),
      ),
    );
    this.tilesSelect.addEventListener('change', () =>
      actions.setViewTiles(Number(this.tilesSelect.value)),
    );

    const exportBtn = toolButton(
      'download',
      'Export',
      'Export: image, texture maps, flipbook, every node, document or share link',
      () => actions.openExport(),
      'primary',
    );
    this.accountSlot = h('div', { class: 'account-slot' });
    this.systemLabel = h('button', {
      class: 'system-name',
      title: 'Current system · click to rename',
      onclick: () => actions.renameSystem(),
    });
    this.publishBadge = h('button', {
      class: 'publish-badge',
      hidden: true,
      onclick: () => actions.openCommunity(),
    });

    mainBar.append(
      h('div', { class: 'brand' }, logo(), h('span', { text: 'FX Designer' })),
      h(
        'div',
        { class: 'tool-group' },
        fileMenu(actions, () => this.state),
        toolButton('library', 'Library', 'Your systems: open, create, rename, duplicate', () =>
          actions.openLibrary(),
        ),
        toolButton(
          'globe',
          'Community',
          'Systems shared by everyone: browse, subscribe, publish',
          () => actions.openCommunity(),
        ),
      ),
      this.systemLabel,
      this.publishBadge,
      h('div', { class: 'spacer' }),
      this.accountSlot,
      layoutMenu(layout),
      h('div', { class: 'tool-group' }, exportBtn),
    );

    viewportBar.append(h('div', { class: 'vp-group' }, icon('grid', 14), this.tilesSelect));
  }

  update(state: ToolbarState): void {
    this.state = state;
    this.tilesSelect.value = String(state.viewTiles);
    this.systemLabel.textContent = state.systemName;
    const badge = this.publishBadge;
    badge.hidden = state.publishState === 'local';
    badge.className = `publish-badge ${state.publishState}`;
    badge.replaceChildren(
      icon('globe', 13),
      state.publishState === 'modified' ? 'Modified' : 'Published',
    );
    badge.title =
      state.publishState === 'modified'
        ? 'Changed since it was published: open the community to publish an update'
        : 'Published in the community, up to date';
  }
}

/** App logo: the site's favicon (public/favicon.svg), so both always match. */
function logo(): HTMLElement {
  return h(
    'span',
    { class: 'logo', 'aria-hidden': 'true' },
    h('img', {
      src: `${import.meta.env.BASE_URL}favicon.svg`,
      alt: '',
      width: 22,
      height: 22,
      draggable: false,
    }),
  );
}

/** "File" dropdown: systems, documents, history and library files. */
function fileMenu(actions: ToolbarActions, state: () => ToolbarState): HTMLElement {
  const button = toolButton(
    'open',
    'File',
    'New, open, save, undo / redo, library files',
    () => undefined,
  );
  const panel = h('div', { class: 'menu-panel', role: 'menu' });
  const root = h('div', { class: 'menu-root' }, button, panel);
  const item = (
    iconName: IconName | null,
    label: string,
    run: () => void,
    shortcut = '',
    disabled = false,
  ) =>
    h(
      'button',
      {
        class: 'menu-item',
        role: 'menuitem',
        disabled,
        onclick: () => {
          popover.close();
          run();
        },
      },
      h('span', { class: 'menu-check' }, iconName ? icon(iconName, 14) : null),
      h('span', { text: label }),
      shortcut ? h('kbd', { text: shortcut }) : null,
    );
  const popover = attachPopover(root, button, panel, () => {
    const s = state();
    panel.replaceChildren(
      item('zoomIn', 'New system', () => actions.newSystem()),
      item('open', 'Open document…', () => actions.loadFile()),
      item('save', 'Save document', () => actions.saveFile()),
      h('div', { class: 'menu-sep' }),
      item('undo', 'Undo', () => actions.undo(), 'Ctrl+Z', !s.canUndo),
      item('redo', 'Redo', () => actions.redo(), 'Ctrl+Shift+Z', !s.canRedo),
      h('div', { class: 'menu-sep' }),
      item('library', 'Save library…', () => actions.saveLibrary()),
      item('library', 'Open library…', () => actions.loadLibrary()),
    );
  });
  return root;
}

/** "Layout" dropdown: show / hide editor parts, reset. */
function layoutMenu(layout: Layout): HTMLElement {
  const button = toolButton('layout', 'Layout', 'Show or hide panels', () => undefined);
  const panel = h('div', { class: 'menu-panel', role: 'menu' });
  const root = h('div', { class: 'tool-group menu-root' }, button, panel);
  const build = () => {
    panel.replaceChildren(
      ...LAYOUT_PARTS.map((part) =>
        h(
          'button',
          {
            class: `menu-item${layout.isVisible(part.id) ? ' checked' : ''}`,
            role: 'menuitemcheckbox',
            'aria-checked': String(layout.isVisible(part.id)),
            'data-part': part.id,
            onclick: () => {
              layout.toggle(part.id);
              build();
            },
          },
          h('span', { class: 'menu-check' }, icon('check', 14)),
          h('span', { text: part.label }),
          part.shortcut ? h('kbd', { text: part.shortcut }) : null,
        ),
      ),
      h('div', { class: 'menu-sep' }),
      h(
        'button',
        {
          class: 'menu-item',
          role: 'menuitem',
          onclick: () => {
            layout.reset();
            build();
          },
        },
        h('span', { class: 'menu-check' }),
        h('span', { text: 'Reset layout' }),
      ),
    );
  };
  attachPopover(root, button, panel, build);
  return root;
}
