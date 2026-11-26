import { h } from './dom';

export interface FlipbookOptions {
  readonly columns: number;
  readonly rows: number;
  readonly frameSize: number;
  /** Seconds covered by the whole sheet (shader generators). */
  readonly duration: number;
  /** Simulation frames advanced between captured frames (simulations). */
  readonly stepsBetweenFrames: number;
  /**
   * Seconds skipped before the first captured frame: time offset for shader generators,
   * warm-up run (at 60 simulation frames / s) for simulations.
   */
  readonly startTime: number;
  /** Simulations: restart from the seed before the warm-up (otherwise continue the live run). */
  readonly restart: boolean;
  /** Also bake a motion vector sheet (optical flow from each frame to the next). */
  readonly motionVectors: boolean;
  /**
   * Dilate (padding) of each frame, in px (0 = off): colors spread under the transparent
   * pixels so mipmaps of alpha-cutout sprites don't bleed dark edges.
   */
  readonly padding: number;
}

/** Simulation frames per second of warm-up (one step per displayed frame at 60 Hz). */
export const SIM_FRAMES_PER_SECOND = 60;

const DEFAULTS: FlipbookOptions = {
  columns: 8,
  rows: 8,
  frameSize: 128,
  duration: 2,
  stepsBetweenFrames: 10,
  startTime: 0,
  restart: true,
  motionVectors: false,
  padding: 0,
};

/**
 * What the sheet holds: frames of a shader animation, frames of a simulation run, or
 * variations (one random seed per cell, same time).
 */
export type SheetMode = 'shader' | 'simulation' | 'variations';

/** Modal asking for sprite-sheet layout. Resolves null when cancelled. */
export function askFlipbookOptions(
  mode: SheetMode,
  maxSize: number,
  defaults: Partial<FlipbookOptions> = {},
  /** Frame pixel size for a given frame size setting (non-square workspaces). */
  dims: (frameSize: number) => readonly [number, number] = (s) => [s, s],
): Promise<FlipbookOptions | null> {
  const initial = { ...DEFAULTS, ...defaults };
  const isSimulation = mode === 'simulation';
  const variations = mode === 'variations';
  const unit = variations ? 'variations' : 'frames';
  return new Promise((resolve) => {
    const num = (name: string, value: number, min: number, max: number, step = 1) =>
      h('input', {
        type: 'number',
        name,
        value: String(value),
        min,
        max,
        step,
        class: 'num',
        required: true,
      });
    const columns = num('columns', initial.columns, 1, 32);
    const rows = num('rows', initial.rows, 1, 32);
    const frameSize = h(
      'select',
      { name: 'frameSize' },
      ...[64, 128, 256, 512].map((s) =>
        h('option', { value: String(s), text: `${s}px`, selected: s === initial.frameSize }),
      ),
    );
    const duration = num('duration', initial.duration, 0.1, 60, 0.1);
    const steps = num('steps', initial.stepsBetweenFrames, 1, 500);
    const start = num('start', initial.startTime, 0, 600, 0.1);
    const restart = h('input', { type: 'checkbox', name: 'restart', checked: initial.restart });
    const motion = h('input', {
      type: 'checkbox',
      name: 'motionVectors',
      checked: initial.motionVectors,
      title: 'A second sheet of motion vectors, for smooth frame blending in game engines',
    });
    const padding = h(
      'select',
      {
        name: 'padding',
        title:
          'Spreads the colors under the transparent pixels of each frame (alpha unchanged): ' +
          'no dark or stray edges in the mipmaps of alpha-cutout sprites',
      },
      ...[0, 2, 4, 8, 16, 32].map((px) =>
        h('option', {
          value: String(px),
          text: px ? `${px}px` : 'Off',
          selected: px === initial.padding,
        }),
      ),
    );
    const info = h('p', { class: 'dialog-info' });

    const field = (label: string, input: HTMLElement) =>
      h('label', { class: 'dialog-field' }, h('span', { text: label }), input);
    const form = h(
      'form',
      { method: 'dialog' },
      h('h2', { text: variations ? 'Export variations' : 'Export flipbook' }),
      field('Columns', columns),
      field('Rows', rows),
      field(variations ? 'Cell size' : 'Frame size', frameSize),
      variations
        ? null
        : isSimulation
          ? field('Sim frames between images', steps)
          : field('Duration (s) — loop length for a looping sheet', duration),
      isSimulation ? field('Restart simulation first', restart) : null,
      variations ? null : field('Motion vectors sheet', motion),
      field('Dilate (mip-safe padding)', padding),
      variations
        ? field('Time (s)', start)
        : field(isSimulation ? 'Warm-up before capture (s)' : 'Start at (s)', start),
      info,
      h(
        'div',
        { class: 'dialog-buttons' },
        h('button', {
          type: 'button',
          class: 'btn',
          value: 'cancel',
          text: 'Cancel',
          onclick: () => dialog.close('cancel'),
        }),
        h('button', { type: 'submit', class: 'btn btn-primary', value: 'ok', text: 'Export' }),
      ),
    );
    const dialog = h('dialog', { class: 'dialog' }, form);

    const read = (): FlipbookOptions => ({
      columns: Number(columns.value),
      rows: Number(rows.value),
      frameSize: Number(frameSize.value),
      duration: Number(duration.value),
      stepsBetweenFrames: Number(steps.value),
      startTime: Math.max(0, Number(start.value) || 0),
      restart: restart.checked,
      motionVectors: !variations && motion.checked,
      padding: Number(padding.value),
    });
    const refresh = () => {
      const o = read();
      const [fw, fh] = dims(o.frameSize);
      const w = o.columns * fw;
      const hgt = o.rows * fh;
      const warmup =
        isSimulation && o.startTime > 0
          ? ` · ${Math.round(o.startTime * SIM_FRAMES_PER_SECOND)} warm-up frames`
          : '';
      info.textContent = `${o.columns * o.rows} ${unit} — sheet ${w}×${hgt}px${w > maxSize || hgt > maxSize ? ' (too large!)' : ''}${warmup}`;
    };
    form.addEventListener('input', refresh);
    refresh();

    dialog.addEventListener('close', () => {
      const ok = dialog.returnValue === 'ok';
      const o = read();
      dialog.remove();
      const valid =
        o.columns >= 1 &&
        o.rows >= 1 &&
        o.columns * dims(o.frameSize)[0] <= maxSize &&
        o.rows * dims(o.frameSize)[1] <= maxSize;
      resolve(ok && valid ? o : null);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}
