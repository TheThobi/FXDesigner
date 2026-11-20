import { h } from './dom';

export interface FlipbookOptions {
  readonly columns: number;
  readonly rows: number;
  readonly frameSize: number;
  /** Seconds covered by the whole sheet (shader generators). */
  readonly duration: number;
  /** Simulation frames advanced between captured frames (simulations). */
  readonly stepsBetweenFrames: number;
}

const DEFAULTS: FlipbookOptions = {
  columns: 8,
  rows: 8,
  frameSize: 128,
  duration: 2,
  stepsBetweenFrames: 10,
};

/** Modal asking for sprite-sheet layout. Resolves null when cancelled. */
export function askFlipbookOptions(
  isSimulation: boolean,
  maxSize: number,
  defaults: Partial<FlipbookOptions> = {},
): Promise<FlipbookOptions | null> {
  const initial = { ...DEFAULTS, ...defaults };
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
    const info = h('p', { class: 'dialog-info' });

    const field = (label: string, input: HTMLElement) =>
      h('label', { class: 'dialog-field' }, h('span', { text: label }), input);
    const form = h(
      'form',
      { method: 'dialog' },
      h('h2', { text: 'Export flipbook' }),
      field('Columns', columns),
      field('Rows', rows),
      field('Frame size', frameSize),
      isSimulation
        ? field('Sim frames between images', steps)
        : field('Duration (s) — loop length for a looping sheet', duration),
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
    });
    const refresh = () => {
      const o = read();
      const w = o.columns * o.frameSize;
      const hgt = o.rows * o.frameSize;
      info.textContent = `${o.columns * o.rows} frames — sheet ${w}×${hgt}px${w > maxSize || hgt > maxSize ? ' (too large!)' : ''}`;
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
        o.columns * o.frameSize <= maxSize &&
        o.rows * o.frameSize <= maxSize;
      resolve(ok && valid ? o : null);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}
