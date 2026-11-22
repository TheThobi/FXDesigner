import type {
  BoolParam,
  ParamDef,
  ParamGroupInfo,
  ParamValue,
  ParamValues,
  Preset,
} from '../params/types';
import { deepEqual } from '../util/equal';
import { createControl, type Control } from './controls';
import { clear, h } from './dom';
import { icon, isIconName } from './icons';

/** Visual preset picker shown above the parameters. */
export interface PresetGalleryOptions {
  readonly title: string;
  readonly presets: readonly Preset[];
  /** User presets, after the built-in ones. */
  readonly userPresets?: readonly Preset[];
  readonly onPick: (preset: Preset) => void;
  /** Pointer over a tile (preview it live), null when it leaves. */
  readonly onHover?: (preset: Preset | null) => void;
  /** Image of the result (data URL), or null when it can't be previewed. */
  readonly thumbnail?: (preset: Preset) => Promise<string | null>;
  /** Extra elements in the gallery header (e.g. the user preset manager). */
  readonly extras?: readonly HTMLElement[];
  /** 'bottom': after the parameters (default: above them). */
  readonly position?: 'top' | 'bottom';
  /** Shown only when this returns true for the panel's values (like ParamDef.visibleWhen). */
  readonly visibleWhen?: (values: Readonly<Record<string, unknown>>) => boolean;
}

export interface ParamPanelOptions {
  readonly defs: readonly ParamDef[];
  readonly values: ParamValues;
  readonly gallery?: PresetGalleryOptions;
  /** Extra elements shown in the actions row. */
  readonly extras?: readonly HTMLElement[];
  /** Elements appended to a row's value cell, by param key (e.g. a random seed button). */
  readonly rowExtras?: Readonly<Record<string, HTMLElement>>;
  readonly onChange: (key: string, value: ParamValue) => void;
  readonly onReset?: () => void;
  /** Extra buttons shown next to "Reset all". */
  readonly actions?: readonly { label: string; title?: string; onClick: () => void }[];
  /** Per-key defaults overriding the schema ones (reset target, reset-arrow reference). */
  readonly defaults?: ParamValues;
  /** Module metadata (descriptions, header summaries) keyed by group name. */
  readonly groups?: readonly ParamGroupInfo[];
}

const DEFAULT_GROUP = 'General';

interface Row {
  readonly def: ParamDef;
  readonly control: Control;
  readonly element: HTMLElement;
  readonly resetButton: HTMLButtonElement;
  readonly defaultValue: ParamValue;
}

interface Section {
  readonly name: string;
  readonly element: HTMLDetailsElement;
  readonly toggle: BoolParam | null;
  readonly checkbox: HTMLInputElement | null;
  readonly summary: HTMLElement;
  readonly info: ParamGroupInfo | undefined;
}

/**
 * Schema-driven property editor. Parameters are organised in modules (groups): a module may
 * own an on/off switch (a `toggle` bool param) shown in its header, a description and a live
 * summary of its state, so the panel stays readable with many parameters.
 */
export class ParamPanel {
  private rows = new Map<string, Row>();
  private sections: Section[] = [];
  private readonly collapsed = new Set<string>();
  private values: Record<string, ParamValue> = {};
  private query = '';
  private gallery: {
    readonly opts: PresetGalleryOptions;
    readonly tiles: HTMLElement[];
    readonly element: HTMLElement;
  } | null = null;
  /** Gallery collapsed state, per gallery title (kept across renders). */
  private static readonly closedGalleries = new Set<string>();

  constructor(readonly element: HTMLElement) {
    element.classList.add('param-panel');
  }

  render(opts: ParamPanelOptions): void {
    clear(this.element);
    this.rows.clear();
    this.sections = [];
    this.values = { ...opts.values };

    this.gallery = null;
    const gallery =
      opts.gallery && (opts.gallery.presets.length || opts.gallery.userPresets?.length)
        ? this.buildGallery(opts.gallery)
        : null;
    if (gallery && opts.gallery?.position !== 'bottom') this.element.append(gallery);

    const actions = h('div', { class: 'panel-actions' });
    actions.append(...(opts.extras ?? []));
    if (opts.onReset) {
      actions.append(
        h(
          'button',
          { class: 'btn btn-small', title: 'Restore all defaults', onclick: opts.onReset },
          icon('reset', 12),
          'Reset all',
        ),
      );
    }
    for (const a of opts.actions ?? []) {
      actions.append(
        h('button', { class: 'btn btn-small', text: a.label, title: a.title, onclick: a.onClick }),
      );
    }
    if (actions.childElementCount > 0) this.element.append(actions);

    const groups = new Map<string, ParamDef[]>();
    for (const def of opts.defs) {
      const g = def.group ?? DEFAULT_GROUP;
      groups.set(g, [...(groups.get(g) ?? []), def]);
    }

    for (const [name, defs] of groups) {
      const section = this.section(name, defs, opts);
      this.sections.push(section);
      this.element.append(section.element);
    }
    if (gallery && opts.gallery?.position === 'bottom') this.element.append(gallery);
    this.refreshSections();
    this.filter(this.query);
  }

  /** Asks the thumbnails of the gallery again (they are cached by the provider). */
  reloadThumbnails(): void {
    const g = this.gallery;
    if (!g?.opts.thumbnail) return;
    const list = [...g.opts.presets, ...(g.opts.userPresets ?? [])];
    g.tiles.forEach((tile, i) => {
      const preset = list[i];
      if (preset) this.loadThumb(g.opts, tile, preset);
    });
  }

  private loadThumb(opts: PresetGalleryOptions, tile: HTMLElement, preset: Preset): void {
    const img = tile.querySelector('img');
    if (!img || !opts.thumbnail) return;
    void opts.thumbnail(preset).then((url) => {
      if (!url || !img.isConnected) return;
      if (img.src !== url) img.src = url;
      tile.classList.add('loaded');
    });
  }

  private buildGallery(opts: PresetGalleryOptions): HTMLElement {
    const tiles: HTMLElement[] = [];
    const tile = (preset: Preset, user: boolean) => {
      const el = h(
        'button',
        {
          type: 'button',
          class: `preset-tile${user ? ' user' : ''}`,
          title: `${preset.name} · click to apply`,
          onclick: () => opts.onPick(preset),
        },
        h(
          'span',
          { class: 'preset-thumb' },
          opts.thumbnail ? h('img', { alt: '', draggable: false }) : null,
        ),
        h('span', { class: 'preset-name', text: preset.name }),
      );
      if (opts.onHover) {
        el.addEventListener('pointerenter', () => opts.onHover?.(preset));
        el.addEventListener('pointerleave', () => opts.onHover?.(null));
      }
      tiles.push(el);
      this.loadThumb(opts, el, preset);
      return el;
    };
    const user = opts.userPresets ?? [];
    const grid = h(
      'div',
      { class: 'preset-grid' },
      ...opts.presets.map((p) => tile(p, false)),
      ...(user.length
        ? [
            h('div', { class: 'preset-divider', text: 'My presets' }),
            ...user.map((p) => tile(p, true)),
          ]
        : []),
    );
    const count = opts.presets.length + user.length;
    const details = h(
      'details',
      { class: 'preset-gallery', open: !ParamPanel.closedGalleries.has(opts.title) },
      h(
        'summary',
        {},
        h('span', { class: 'group-title', text: opts.title }),
        h('span', { class: 'module-summary', text: String(count) }),
        h('span', { class: 'preset-extras' }, ...(opts.extras ?? [])),
      ),
      grid,
    );
    details.querySelector('.preset-extras')?.addEventListener('click', (e) => e.preventDefault());
    details.addEventListener('toggle', () => {
      if (details.open) ParamPanel.closedGalleries.delete(opts.title);
      else ParamPanel.closedGalleries.add(opts.title);
    });
    // Leaving the panel while hovering a tile ends the preview.
    grid.addEventListener('pointerleave', () => opts.onHover?.(null));
    this.gallery = { opts, tiles, element: details };
    return details;
  }

  /** Pushes new values into existing widgets (no rebuild, no change events). */
  setValues(values: ParamValues): void {
    for (const [key, row] of this.rows) {
      const v = values[key];
      if (v === undefined) continue;
      this.values[key] = v;
      row.control.setValue(v);
      showReset(row.resetButton, row.defaultValue, v);
    }
    for (const s of this.sections) {
      if (s.toggle && s.checkbox) {
        const v = values[s.toggle.key];
        if (typeof v === 'boolean') {
          this.values[s.toggle.key] = v;
          s.checkbox.checked = v;
        }
      }
    }
    this.refreshSections();
  }

  /**
   * Greys out (and blocks) the rows of `keys`, e.g. settings of an unconnected input; `reason`
   * becomes their tooltip.
   */
  setDisabled(keys: ReadonlySet<string>, reason: string): void {
    for (const [key, row] of this.rows) {
      const off = keys.has(key);
      row.element.classList.toggle('disabled', off);
      row.element.toggleAttribute('inert', off);
      if (off) row.element.title = reason;
      else row.element.removeAttribute('title');
    }
  }

  /** Number of values differing from their defaults. */
  modifiedCount(): number {
    let n = 0;
    for (const row of this.rows.values()) if (row.resetButton.classList.contains('visible')) n++;
    return n;
  }

  /** Shows only rows whose label or key matches `query`; hides empty sections. */
  filter(query: string): void {
    this.query = query.trim().toLowerCase();
    for (const row of this.rows.values()) {
      const match =
        !this.query ||
        `${row.def.label} ${row.def.key} ${row.def.group ?? ''}`.toLowerCase().includes(this.query);
      row.element.hidden = !match;
    }
    for (const s of this.sections) {
      const visible =
        s.element.querySelector('.param-row:not([hidden]):not(.cond-hidden)') !== null;
      s.element.hidden = !visible;
      if (this.query && visible) s.element.open = true;
    }
  }

  private section(name: string, defs: ParamDef[], opts: ParamPanelOptions): Section {
    const toggle = defs.find((d): d is BoolParam => d.type === 'bool' && d.toggle === true) ?? null;
    const info = opts.groups?.find((g) => g.name === name);
    const element = h('details', {
      class: `param-group${toggle ? ' module' : ''}`,
      'data-group': name,
    });
    const summary = h('span', { class: 'module-summary' });
    let checkbox: HTMLInputElement | null = null;

    const head = h('summary', {});
    if (toggle) {
      checkbox = h('input', {
        type: 'checkbox',
        class: 'module-toggle',
        'data-key': toggle.key,
        title: toggle.description ?? `Enable ${name}`,
        'aria-label': `Enable ${name}`,
      });
      checkbox.checked = this.values[toggle.key] === true;
      const box = checkbox;
      box.addEventListener('click', (e) => e.stopPropagation());
      box.addEventListener('change', () => {
        this.values[toggle.key] = box.checked;
        opts.onChange(toggle.key, box.checked);
        element.open = box.checked;
        this.refreshSections();
      });
      head.append(checkbox);
    }
    const groupIcon = isIconName(info?.icon) ? icon(info.icon, 14) : null;
    if (groupIcon) {
      groupIcon.classList.add('group-icon');
      head.append(groupIcon);
    }
    head.append(h('span', { class: 'group-title', text: name }), summary);
    element.append(head);
    if (info?.description) element.append(h('p', { class: 'module-desc', text: info.description }));
    for (const def of defs) if (def !== toggle) element.append(this.row(def, opts).element);

    const enabled = !toggle || this.values[toggle.key] === true;
    element.open = enabled && !this.collapsed.has(name);
    element.addEventListener('toggle', () => {
      if (element.open) this.collapsed.delete(name);
      else this.collapsed.add(name);
    });

    return { name, element, toggle, checkbox, summary, info };
  }

  /** Updates module headers (summary text, on/off look) from current values. */
  private refreshSections(): void {
    for (const row of this.rows.values()) {
      const shown = row.def.visibleWhen ? row.def.visibleWhen(this.values) : true;
      row.element.classList.toggle('cond-hidden', !shown);
    }
    const g = this.gallery;
    if (g?.opts.visibleWhen) g.element.hidden = !g.opts.visibleWhen(this.values);
    // Sections whose rows are all hidden by the current values disappear too.
    for (const s of this.sections) {
      const visible = s.element.querySelector('.param-row:not([hidden]):not(.cond-hidden)');
      s.element.hidden = visible === null && !s.toggle;
    }
    for (const s of this.sections) {
      const on = !s.toggle || this.values[s.toggle.key] === true;
      s.element.classList.toggle('is-off', !on);
      const text = s.toggle && !on ? 'Off' : (s.info?.summary?.(this.values) ?? '');
      s.summary.textContent = text;
      s.summary.hidden = text === '';
    }
  }

  private row(def: ParamDef, opts: ParamPanelOptions): Row {
    const defaultValue = opts.defaults?.[def.key] ?? def.default;
    const initial = opts.values[def.key] ?? defaultValue;
    const resetButton = h(
      'button',
      { class: 'reset-btn', title: 'Reset to default', 'aria-label': `Reset ${def.label}` },
      icon('reset', 12),
    );
    const control = createControl(def, initial, (v) => {
      this.values[def.key] = v;
      showReset(resetButton, defaultValue, v);
      this.refreshSections();
      opts.onChange(def.key, v);
    });
    const reset = () => {
      control.setValue(defaultValue);
      this.values[def.key] = defaultValue;
      showReset(resetButton, defaultValue, defaultValue);
      this.refreshSections();
      opts.onChange(def.key, defaultValue);
    };
    resetButton.addEventListener('click', reset);
    const label = h('label', {
      class: 'param-label',
      text: def.label,
      title: [def.description, 'Double-click to reset'].filter(Boolean).join('\n'),
    });
    label.addEventListener('dblclick', reset);
    const wide = def.type === 'gradient' || def.type === 'image';
    const element = h(
      'div',
      { class: `param-row${wide ? ' wide' : ''}`, 'data-key': def.key },
      label,
      h('div', { class: 'param-value' }, control.element, opts.rowExtras?.[def.key] ?? null),
      resetButton,
    );
    const row: Row = { def, control, element, resetButton, defaultValue };
    this.rows.set(def.key, row);
    showReset(resetButton, defaultValue, initial);
    return row;
  }
}

/** The reset arrow is only visible while the value differs from its default. */
function showReset(button: HTMLElement, defaultValue: ParamValue, value: ParamValue): void {
  button.classList.toggle('visible', !deepEqual(value, defaultValue));
}
