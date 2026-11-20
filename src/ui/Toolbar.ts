import { MAX_SEED } from '../util/random';
import { h } from './dom';

export interface ToolbarState {
  readonly playing: boolean;
  readonly animated: boolean;
  readonly seed: number;
  readonly resolution: number;
  readonly viewTiles: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface ToolbarActions {
  togglePlay(): void;
  restart(): void;
  setSeed(seed: number): void;
  randomSeed(): void;
  setResolution(size: number): void;
  setViewTiles(n: number): void;
  undo(): void;
  redo(): void;
  exportPng(): void;
  exportFlipbook(): void;
  share(): void;
  saveFile(): void;
  loadFile(): void;
}

export class Toolbar {
  private readonly playBtn: HTMLButtonElement;
  private readonly seedInput: HTMLInputElement;
  private readonly resolutionSelect: HTMLSelectElement;
  private readonly tilesSelect: HTMLSelectElement;
  private readonly undoBtn: HTMLButtonElement;
  private readonly redoBtn: HTMLButtonElement;
  private readonly flipbookBtn: HTMLButtonElement;

  constructor(
    readonly element: HTMLElement,
    resolutions: readonly number[],
    actions: ToolbarActions,
  ) {
    this.playBtn = h('button', {
      class: 'btn',
      title: 'Play / pause (Space)',
      onclick: () => actions.togglePlay(),
    });
    const restart = h('button', {
      class: 'btn',
      text: '⟲',
      title: 'Restart time / simulation',
      onclick: () => actions.restart(),
    });

    this.seedInput = h('input', {
      type: 'number',
      class: 'num seed',
      min: 0,
      max: MAX_SEED,
      step: 1,
      'aria-label': 'Seed',
    });
    this.seedInput.addEventListener('change', () =>
      actions.setSeed(Math.round(Number(this.seedInput.value) || 0)),
    );
    const dice = h('button', {
      class: 'btn',
      text: '🎲',
      title: 'Random seed',
      onclick: () => actions.randomSeed(),
    });

    this.resolutionSelect = h(
      'select',
      { 'aria-label': 'Export resolution', title: 'Export resolution' },
      ...resolutions.map((r) => h('option', { value: String(r), text: `${r}²` })),
    );
    this.resolutionSelect.addEventListener('change', () =>
      actions.setResolution(Number(this.resolutionSelect.value)),
    );

    this.tilesSelect = h(
      'select',
      { 'aria-label': 'Tiling preview', title: 'Preview tiling (checks seamlessness)' },
      ...[1, 2, 3].map((n) =>
        h('option', { value: String(n), text: n === 1 ? 'Single' : `Tiled ${n}×${n}` }),
      ),
    );
    this.tilesSelect.addEventListener('change', () =>
      actions.setViewTiles(Number(this.tilesSelect.value)),
    );

    this.undoBtn = h('button', {
      class: 'btn',
      text: '↶',
      title: 'Undo (Ctrl+Z)',
      onclick: () => actions.undo(),
    });
    this.redoBtn = h('button', {
      class: 'btn',
      text: '↷',
      title: 'Redo (Ctrl+Shift+Z)',
      onclick: () => actions.redo(),
    });
    this.flipbookBtn = h('button', {
      class: 'btn',
      text: 'Flipbook…',
      title: 'Export an animated sprite sheet',
      onclick: () => actions.exportFlipbook(),
    });

    element.append(
      h(
        'div',
        { class: 'brand' },
        h('span', { class: 'logo' }),
        h('span', { text: 'Procedural Texture Maker' }),
      ),
      h('div', { class: 'tool-group' }, this.playBtn, restart),
      h('div', { class: 'tool-group' }, h('label', { text: 'Seed' }), this.seedInput, dice),
      h('div', { class: 'tool-group' }, this.tilesSelect),
      h('div', { class: 'tool-group' }, this.undoBtn, this.redoBtn),
      h('div', { class: 'spacer' }),
      h(
        'div',
        { class: 'tool-group' },
        h('button', {
          class: 'btn',
          text: 'Open',
          title: 'Load a .json document',
          onclick: () => actions.loadFile(),
        }),
        h('button', {
          class: 'btn',
          text: 'Save',
          title: 'Save as .json document',
          onclick: () => actions.saveFile(),
        }),
        h('button', {
          class: 'btn',
          text: 'Share link',
          title: 'Copy a URL containing the current settings',
          onclick: () => actions.share(),
        }),
      ),
      h(
        'div',
        { class: 'tool-group' },
        this.resolutionSelect,
        h('button', {
          class: 'btn btn-primary',
          text: 'Export PNG',
          onclick: () => actions.exportPng(),
        }),
        this.flipbookBtn,
      ),
    );
  }

  update(state: ToolbarState): void {
    this.playBtn.textContent = state.playing ? '❚❚' : '▶';
    this.playBtn.disabled = !state.animated;
    if (document.activeElement !== this.seedInput) this.seedInput.value = String(state.seed);
    this.resolutionSelect.value = String(state.resolution);
    this.tilesSelect.value = String(state.viewTiles);
    this.undoBtn.disabled = !state.canUndo;
    this.redoBtn.disabled = !state.canRedo;
    this.flipbookBtn.disabled = !state.animated;
  }
}
