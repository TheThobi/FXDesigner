import { h } from './dom';
import { icon, type IconName } from './icons';
import { LAYOUT_PARTS, type Layout } from './Layout';
import { attachPopover } from './popover';

export interface ToolbarState {
  readonly playing: boolean;
  readonly animated: boolean;
  readonly resolution: number;
  readonly viewTiles: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface ToolbarActions {
  togglePlay(): void;
  restart(): void;
  setViewTiles(n: number): void;
  undo(): void;
  redo(): void;
  exportPng(): void;
  exportFlipbook(): void;
  share(): void;
  saveFile(): void;
  loadFile(): void;
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
 * Main toolbar (file, history, export) and the viewport overlay toolbar (play controls,
 * tiling preview), both driven by the same state. Seed and export size live in the Output tab.
 */
export class Toolbar {
  private readonly playBtn: HTMLButtonElement;
  private readonly tilesSelect: HTMLSelectElement;
  private readonly undoBtn: HTMLButtonElement;
  private readonly redoBtn: HTMLButtonElement;
  private readonly exportBtn: HTMLButtonElement;
  private readonly flipbookBtn: HTMLButtonElement;

  constructor(
    mainBar: HTMLElement,
    viewportBar: HTMLElement,
    actions: ToolbarActions,
    layout: Layout,
  ) {
    this.playBtn = h('button', {
      class: 'vp-btn play',
      title: 'Play / pause (Space)',
      onclick: () => actions.togglePlay(),
    });
    const restart = h(
      'button',
      { class: 'vp-btn', title: 'Restart time / simulation', onclick: () => actions.restart() },
      icon('restart', 16),
    );
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

    this.undoBtn = toolButton('undo', '', 'Undo (Ctrl+Z)', () => actions.undo());
    this.redoBtn = toolButton('redo', '', 'Redo (Ctrl+Shift+Z)', () => actions.redo());
    this.exportBtn = toolButton('download', 'Export PNG', '', () => actions.exportPng(), 'primary');
    this.flipbookBtn = toolButton('film', 'Flipbook', 'Export an animated sprite sheet', () =>
      actions.exportFlipbook(),
    );

    mainBar.append(
      h(
        'div',
        { class: 'brand' },
        h('span', { class: 'logo' }),
        h('span', { text: 'Procedural Texture Maker' }),
      ),
      h(
        'div',
        { class: 'tool-group' },
        toolButton('open', 'Open', 'Open a .json document', () => actions.loadFile()),
        toolButton('save', 'Save', 'Save as .json document', () => actions.saveFile()),
        toolButton('link', 'Share', 'Copy a URL containing the current settings', () =>
          actions.share(),
        ),
      ),
      h('div', { class: 'tool-group' }, this.undoBtn, this.redoBtn),
      h('div', { class: 'spacer' }),
      layoutMenu(layout),
      h('div', { class: 'tool-group' }, this.exportBtn, this.flipbookBtn),
    );

    viewportBar.append(
      h('div', { class: 'vp-group' }, this.playBtn, restart),
      h('div', { class: 'vp-group' }, icon('grid', 14), this.tilesSelect),
    );
  }

  update(state: ToolbarState): void {
    this.playBtn.replaceChildren(icon(state.playing ? 'pause' : 'play', 16));
    this.playBtn.classList.toggle('playing', state.playing);
    this.playBtn.disabled = !state.animated;
    this.tilesSelect.value = String(state.viewTiles);
    this.undoBtn.disabled = !state.canUndo;
    this.redoBtn.disabled = !state.canRedo;
    this.flipbookBtn.disabled = !state.animated;
    this.exportBtn.title = `Export a ${state.resolution}×${state.resolution} PNG (size in the Output tab)`;
    const label = this.exportBtn.querySelector('.label');
    if (label) label.textContent = `Export PNG · ${state.resolution}`;
  }
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
