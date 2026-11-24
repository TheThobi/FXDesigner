import { h } from './dom';

export interface VideoOptions {
  /** WebM records in real time; GIF renders offline (palette of 255 colors, 1-bit alpha). */
  readonly format: 'webm' | 'gif';
  /** Long side in pixels. */
  readonly size: number;
  readonly fps: number;
  /** Seconds recorded once (the loop for shaders, the run for simulations). */
  readonly duration: number;
  /** Times the loop is played (shader animations; simulations record `duration` once). */
  readonly repeats: number;
}

/** Modal asking for video settings. Resolves null when cancelled. */
export function askVideoOptions(
  isSimulation: boolean,
  /** WebM recording is available in this browser. */
  webm: boolean,
  defaults: Partial<VideoOptions> = {},
): Promise<VideoOptions | null> {
  const initial: VideoOptions = {
    format: webm ? 'webm' : 'gif',
    size: 512,
    fps: 30,
    duration: 2,
    repeats: 3,
    ...defaults,
  };
  return new Promise((resolve) => {
    const select = (name: string, values: readonly number[], value: number, unit: string) =>
      h(
        'select',
        { name },
        ...values.map((v) =>
          h('option', { value: String(v), text: `${v}${unit}`, selected: v === value }),
        ),
      );
    const num = (name: string, value: number, min: number, max: number, step = 1) =>
      h('input', { type: 'number', name, value: String(value), min, max, step, class: 'num' });
    const format = h(
      'select',
      { name: 'format' },
      h('option', {
        value: 'webm',
        text: 'WebM video',
        disabled: !webm,
        selected: initial.format === 'webm',
      }),
      h('option', { value: 'gif', text: 'Animated GIF', selected: initial.format === 'gif' }),
    );
    const size = select('size', [256, 512, 1024], initial.size, ' px');
    const fps = select('fps', [24, 30, 60], initial.fps, ' fps');
    const duration = num('duration', initial.duration, 0.5, 60, 0.1);
    const repeats = num('repeats', initial.repeats, 1, 20);
    const info = h('p', { class: 'dialog-info' });
    const repeatsField = h(
      'label',
      { class: 'dialog-field' },
      h('span', { text: 'Loops' }),
      repeats,
    );
    const field = (label: string, input: HTMLElement) =>
      h('label', { class: 'dialog-field' }, h('span', { text: label }), input);
    const form = h(
      'form',
      { method: 'dialog' },
      h('h2', { text: 'Export video / GIF' }),
      field('Format', format),
      field('Size (long side)', size),
      field('Frame rate', fps),
      field(isSimulation ? 'Duration (s)' : 'Loop duration (s)', duration),
      repeatsField,
      info,
      h(
        'div',
        { class: 'dialog-buttons' },
        h('button', {
          type: 'button',
          class: 'btn',
          text: 'Cancel',
          onclick: () => dialog.close('cancel'),
        }),
        h('button', { type: 'submit', class: 'btn btn-primary', value: 'ok', text: 'Record' }),
      ),
    );
    const dialog = h('dialog', { class: 'dialog' }, form);
    const read = (): VideoOptions => ({
      format: format.value === 'gif' ? 'gif' : 'webm',
      size: Number(size.value),
      fps: Number(fps.value),
      duration: Math.max(0.5, Number(duration.value) || initial.duration),
      repeats:
        isSimulation || format.value === 'gif'
          ? 1
          : Math.max(1, Math.round(Number(repeats.value) || 1)),
    });
    const refresh = () => {
      const o = read();
      const gif = o.format === 'gif';
      repeatsField.hidden = isSimulation || gif;
      info.textContent = gif
        ? `${Math.round(o.duration * o.fps)} frames, loops forever.${o.size > 512 ? ' Large GIFs get heavy.' : ''}`
        : `Records in real time: ${(o.duration * o.repeats).toFixed(1)} s.`;
    };
    form.addEventListener('input', refresh);
    refresh();
    dialog.addEventListener('close', () => {
      const ok = dialog.returnValue === 'ok';
      const o = read();
      dialog.remove();
      resolve(ok ? o : null);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}
