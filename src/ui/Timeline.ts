import { clamp } from '../util/math';
import { param } from '../params/define';
import { createControl } from './controls';
import type { Control } from './controls/types';
import { h } from './dom';
import { icon, type IconName } from './icons';

/** What the timeline currently drives. */
export type TimelineMode =
  /** Time-based shader generator: seekable time range [0, duration]. */
  | 'time'
  /** Simulation: frame counter, rewind to captured keyframes. */
  | 'frames'
  /** Nothing to animate. */
  | 'static';

export interface TimelineState {
  readonly mode: TimelineMode;
  readonly playing: boolean;
  /** Seconds (time mode). */
  readonly time: number;
  readonly duration: number;
  /** Displayed frames since the simulation started (frames mode). */
  readonly frame: number;
  readonly loopPlayback: boolean;
  readonly seamless: boolean;
  /** Fraction of the loop crossfaded when seamless. */
  readonly blend: number;
  readonly speed: number;
}

export interface TimelineKeyframe {
  readonly frame: number;
  readonly url: string;
}

export interface TimelineActions {
  togglePlay(): void;
  restart(): void;
  /** Time mode: jump to `time` seconds. */
  seek(time: number): void;
  /** Scrubbing started / ended (playback is suspended meanwhile). */
  scrub(active: boolean): void;
  /** One frame forward / backward (back = previous keyframe in frames mode). */
  step(direction: 1 | -1): void;
  setDuration(seconds: number): void;
  setSeamless(on: boolean): void;
  /** Fraction of the loop used by the seamless crossfade. */
  setBlend(fraction: number): void;
  setLoopPlayback(on: boolean): void;
  setSpeed(speed: number): void;
  /** Frames mode: restore the keyframe at `index`. */
  jumpToKeyframe(index: number): void;
  close(): void;
}

const DURATION_PARAM = param.float('loopDuration', 'Duration', 4, 0.5, 60, {
  unit: 's',
  step: 0.1,
});

export const TIMELINE_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
/** Frame step (seconds) used by the step buttons in time mode. */
export const TIMELINE_FPS = 30;

function button(name: IconName, title: string, onclick: () => void): HTMLButtonElement {
  return h('button', { class: 'vp-btn', title, 'aria-label': title, onclick }, icon(name, 14));
}

function niceStep(duration: number, maxTicks: number): number {
  for (const s of [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30]) if (duration / s <= maxTicks) return s;
  return 60;
}

/**
 * Timeline under the viewport: transport, time readout, a track with a filmstrip of frames
 * (time mode) or keyframe snapshots (frames mode), draggable playhead, seamless-loop blend
 * zone, and loop options.
 */
export class Timeline {
  readonly element: HTMLElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly readout: HTMLElement;
  private readonly track: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly ruler: HTMLElement;
  private readonly blendZone: HTMLElement;
  private readonly playhead: HTMLElement;
  private readonly keyLayer: HTMLElement;
  /** Frames mode: span of the run that keyframes can rewind to. */
  private readonly recorded: HTMLElement;
  private readonly empty: HTMLElement;
  private readonly duration: Control;
  private shownDuration = NaN;
  private readonly loopBtn: HTMLButtonElement;
  private readonly seamlessBtn: HTMLButtonElement;
  private readonly speedSelect: HTMLSelectElement;
  private readonly timeOptions: HTMLElement;
  private state: TimelineState | null = null;
  private keyframes: readonly TimelineKeyframe[] = [];
  private rulerFor = '';

  constructor(private readonly actions: TimelineActions) {
    this.playBtn = h('button', {
      class: 'vp-btn play',
      title: 'Play / pause (Space)',
      onclick: () => actions.togglePlay(),
    });
    this.readout = h('span', { class: 'tl-readout' });
    // Same drag-to-scrub field as the Details panel (drag, Shift = fine, click to type).
    this.duration = createControl(DURATION_PARAM, 4, (v) => actions.setDuration(Number(v)));
    this.duration.element.classList.add('tl-duration');
    this.duration.element.title = 'Loop duration: drag to change, click to type';
    this.loopBtn = h(
      'button',
      {
        class: 'tl-toggle',
        title: 'Loop playback (off: time keeps running past the end of the timeline)',
        onclick: () => actions.setLoopPlayback(!this.state?.loopPlayback),
      },
      icon('repeat', 14),
      h('span', { text: 'Loop' }),
    );
    this.seamlessBtn = h(
      'button',
      {
        class: 'tl-toggle',
        title:
          'Force a seamless loop: crossfades the end into the start so the animation repeats ' +
          'without a jump (may soften the effect during the blend)',
        onclick: () => actions.setSeamless(!this.state?.seamless),
      },
      icon('flow', 14),
      h('span', { text: 'Seamless' }),
    );
    this.speedSelect = h(
      'select',
      { class: 'vp-select tl-speed', 'aria-label': 'Playback speed', title: 'Playback speed' },
      ...TIMELINE_SPEEDS.map((s) => h('option', { value: String(s), text: `${s}×` })),
    );
    this.speedSelect.addEventListener('change', () =>
      actions.setSpeed(Number(this.speedSelect.value)),
    );
    this.timeOptions = h(
      'div',
      { class: 'tl-group' },
      h('label', { class: 'tl-field' }, icon('clock', 14), this.duration.element),
      this.loopBtn,
      this.seamlessBtn,
    );

    this.strip = h('div', { class: 'tl-strip' });
    this.ruler = h('div', { class: 'tl-ruler' });
    this.blendZone = h(
      'div',
      { class: 'tl-blend' },
      h('div', {
        class: 'tl-blend-handle',
        title: 'Seamless loop crossfade: drag to resize the blend window',
      }),
    );
    this.bindBlend();
    this.keyLayer = h('div', { class: 'tl-keys' });
    this.recorded = h('div', { class: 'tl-recorded' });
    this.playhead = h('div', { class: 'tl-playhead' });
    this.empty = h('div', { class: 'tl-empty', hidden: true });
    this.track = h(
      'div',
      { class: 'tl-track' },
      this.strip,
      this.recorded,
      this.blendZone,
      this.keyLayer,
      this.ruler,
      this.playhead,
      this.empty,
    );
    this.bindTrack();

    // Three columns: info (left), transport (always centered), options (right).
    this.element = h(
      'section',
      { class: 'timeline', 'aria-label': 'Timeline' },
      h(
        'div',
        { class: 'tl-bar' },
        h('div', { class: 'tl-side tl-left' }, this.readout),
        h(
          'div',
          { class: 'tl-group tl-transport' },
          button('restart', 'Restart', () => actions.restart()),
          button('stepBack', 'Previous frame (,)', () => actions.step(-1)),
          this.playBtn,
          button('stepForward', 'Next frame (.)', () => actions.step(1)),
        ),
        h(
          'div',
          { class: 'tl-side tl-right' },
          this.timeOptions,
          h('div', { class: 'tl-group' }, this.speedSelect),
          h(
            'button',
            {
              class: 'vp-btn tl-close',
              title: 'Hide the timeline (T)',
              'aria-label': 'Hide the timeline',
              onclick: () => actions.close(),
            },
            icon('close', 14),
          ),
        ),
      ),
      this.track,
    );
  }

  /** Cheap: called every displayed frame. */
  /** The next update must refresh the DOM even if the state is unchanged. */
  private stale = true;

  update(state: TimelineState): void {
    const prev = this.state;
    // Called every frame: an unchanged state touches no DOM (no style / layout work).
    if (
      !this.stale &&
      prev &&
      (Object.keys(state) as (keyof TimelineState)[]).every((k) => prev[k] === state[k])
    )
      return;
    this.stale = false;
    this.state = state;
    if (prev?.mode !== state.mode) this.element.dataset.mode = state.mode;
    if (prev?.playing !== state.playing || prev.mode !== state.mode) {
      this.playBtn.replaceChildren(icon(state.playing ? 'pause' : 'play', 14));
      this.playBtn.classList.toggle('playing', state.playing);
    }
    this.playBtn.disabled = state.mode === 'static';
    this.timeOptions.hidden = state.mode !== 'time';
    this.empty.hidden = state.mode !== 'static';
    this.empty.textContent = state.mode === 'static' ? 'Static generator: nothing to animate' : '';

    if (state.duration !== this.shownDuration) {
      this.shownDuration = state.duration;
      this.duration.setValue(state.duration);
    }
    this.loopBtn.classList.toggle('on', state.loopPlayback);
    this.seamlessBtn.classList.toggle('on', state.seamless);
    this.speedSelect.value = String(state.speed);

    if (state.mode === 'time') {
      const t = state.time;
      const past = t > state.duration + 1e-6 ? ' (past end)' : '';
      this.readout.textContent = `${t.toFixed(2)} s / ${state.duration.toFixed(2)} s · f${Math.floor(t * TIMELINE_FPS)}${past}`;
      this.setPlayhead(t / state.duration);
      this.blendZone.hidden = !state.seamless;
      this.blendZone.style.width = `${state.blend * 100}%`;
      const rulerKey = `t${state.duration}`;
      if (rulerKey !== this.rulerFor) this.buildRuler(state.duration);
    } else if (state.mode === 'frames') {
      const keys = this.keyframes.length;
      this.readout.textContent = `Frame ${state.frame} · ${keys} snapshot${keys === 1 ? '' : 's'}`;
      this.blendZone.hidden = true;
      const span = this.frameSpan();
      this.setPlayhead(state.frame / span);
      const newest = Math.max(state.frame, this.keyframes.at(-1)?.frame ?? 0);
      this.recorded.style.width = `${clamp(newest / span, 0, 1) * 100}%`;
      const rulerKey = `f${span}`;
      if (rulerKey !== this.rulerFor) this.layoutKeyframes();
    } else {
      this.readout.textContent = '';
      this.blendZone.hidden = true;
      this.setPlayhead(0);
    }
    this.recorded.hidden = state.mode !== 'frames';
  }

  /** Time mode: images of frames evenly spread over the loop (null = not rendered yet). */
  setFilmstrip(urls: readonly (string | null)[]): void {
    if (this.strip.childElementCount !== urls.length) {
      this.strip.replaceChildren(
        ...urls.map(() => h('img', { alt: '', draggable: false, class: 'tl-frame' })),
      );
    }
    urls.forEach((url, i) => {
      const img = this.strip.children[i] as HTMLImageElement;
      if (url && img.src !== url) {
        img.src = url;
        img.classList.add('loaded');
      } else if (!url) {
        img.classList.remove('loaded');
      }
    });
  }

  clearFilmstrip(): void {
    this.strip.replaceChildren();
  }

  /** Frames mode: snapshots the user can jump back to. */
  setKeyframes(keyframes: readonly TimelineKeyframe[]): void {
    this.stale = true;
    this.keyframes = keyframes;
    this.layoutKeyframes();
  }

  /** Number of filmstrip slots that fit the track. */
  filmstripSlots(): number {
    const w = this.track.clientWidth || 600;
    return clamp(Math.round(w / 56), 6, 24);
  }

  private frameSpan(): number {
    const last = this.keyframes.at(-1)?.frame ?? 0;
    const current = this.state?.frame ?? 0;
    // Round up so the span (and keyframe layout) only changes occasionally.
    const max = Math.max(last, current, 60);
    return 2 ** Math.ceil(Math.log2(max * 1.05));
  }

  private layoutKeyframes(): void {
    const span = this.frameSpan();
    this.rulerFor = `f${span}`;
    const step = span / 8;
    this.ruler.replaceChildren(
      ...Array.from({ length: 8 }, (_, i) =>
        h('span', { class: 'tl-tick', style: `left: ${(i / 8) * 100}%`, text: `${i * step}` }),
      ),
    );
    this.keyLayer.replaceChildren(
      ...this.keyframes.map((k, i) =>
        h(
          'button',
          {
            class: 'tl-key',
            title: `Jump back to frame ${k.frame}`,
            style: `left: ${(k.frame / span) * 100}%`,
            onclick: (e: Event) => {
              e.stopPropagation();
              this.actions.jumpToKeyframe(i);
            },
          },
          h('img', { src: k.url, alt: '', draggable: false }),
        ),
      ),
    );
  }

  private buildRuler(duration: number): void {
    this.rulerFor = `t${duration}`;
    this.keyLayer.replaceChildren();
    const step = niceStep(duration, 12);
    const ticks: HTMLElement[] = [];
    for (let t = 0; t <= duration + 1e-6; t += step) {
      ticks.push(
        h('span', {
          class: 'tl-tick',
          style: `left: ${(t / duration) * 100}%`,
          text: `${+t.toFixed(2)}s`,
        }),
      );
    }
    this.ruler.replaceChildren(...ticks);
  }

  private bindBlend(): void {
    const handle = this.blendZone.firstElementChild as HTMLElement;
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      this.blendZone.classList.add('dragging');
      const move = (ev: PointerEvent) => {
        const rect = this.track.getBoundingClientRect();
        const blend = clamp(1 - (ev.clientX - rect.left) / rect.width, 0.05, 1);
        this.blendZone.style.width = `${blend * 100}%`;
        this.actions.setBlend(+blend.toFixed(3));
      };
      const up = () => {
        this.blendZone.classList.remove('dragging');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  private setPlayhead(fraction: number): void {
    this.playhead.style.left = `${clamp(fraction, 0, 1) * 100}%`;
  }

  private bindTrack(): void {
    const seekAt = (clientX: number) => {
      const s = this.state;
      if (!s || s.mode !== 'time') return;
      const rect = this.track.getBoundingClientRect();
      this.actions.seek(clamp((clientX - rect.left) / rect.width, 0, 1) * s.duration);
    };
    this.track.addEventListener('pointerdown', (e) => {
      const s = this.state;
      if (e.button !== 0 || !s) return;
      if (s.mode === 'frames') {
        // Click or drag: restores the last snapshot before the pointer (live scrub).
        e.preventDefault();
        this.track.setPointerCapture(e.pointerId);
        let shown = -1;
        const jumpAt = (clientX: number) => {
          const rect = this.track.getBoundingClientRect();
          const frame = ((clientX - rect.left) / rect.width) * this.frameSpan();
          let index = -1;
          this.keyframes.forEach((k, i) => {
            if (k.frame <= frame) index = i;
          });
          if (index >= 0 && index !== shown) {
            shown = index;
            this.actions.jumpToKeyframe(index);
          }
        };
        jumpAt(e.clientX);
        const move = (ev: PointerEvent) => jumpAt(ev.clientX);
        const up = () => {
          this.track.removeEventListener('pointermove', move);
          this.track.removeEventListener('pointerup', up);
          this.track.removeEventListener('pointercancel', up);
        };
        this.track.addEventListener('pointermove', move);
        this.track.addEventListener('pointerup', up);
        this.track.addEventListener('pointercancel', up);
        return;
      }
      if (s.mode !== 'time') return;
      e.preventDefault();
      this.track.setPointerCapture(e.pointerId);
      this.track.classList.add('scrubbing');
      this.actions.scrub(true);
      seekAt(e.clientX);
      const move = (ev: PointerEvent) => seekAt(ev.clientX);
      const up = () => {
        this.track.classList.remove('scrubbing');
        this.actions.scrub(false);
        this.track.removeEventListener('pointermove', move);
        this.track.removeEventListener('pointerup', up);
        this.track.removeEventListener('pointercancel', up);
      };
      this.track.addEventListener('pointermove', move);
      this.track.addEventListener('pointerup', up);
      this.track.addEventListener('pointercancel', up);
    });
  }
}
