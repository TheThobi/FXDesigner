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

export interface ParamPanelOptions {
  readonly defs: readonly ParamDef[];
  readonly values: ParamValues;
  readonly presets?: readonly Preset[];
  readonly onChange: (key: string, value: ParamValue) => void;
  readonly onPreset?: (preset: Preset) => void;
  readonly onReset?: () => void;
  /** Extra buttons shown next to "Reset all". */
  readonly actions?: readonly { label: string; title?: string; onClick: () => void }[];
  /** Per-key defaults overriding the schema ones (reset target, reset-arrow reference). */
  readonly defaults?: ParamValues;
  /** Module metadata (descriptions, header summaries) keyed by group name. */
  readonly groups?: readonly ParamGroupInfo[];
  /** Show a strip of module chips (in group order) above the sections. */
  readonly moduleStrip?: boolean;
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
  readonly chip: HTMLButtonElement | null;
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

  constructor(readonly element: HTMLElement) {
    element.classList.add('param-panel');
  }

  render(opts: ParamPanelOptions): void {
    clear(this.element);
    this.rows.clear();
    this.sections = [];
    this.values = { ...opts.values };

    const actions = h('div', { class: 'panel-actions' });
    if (opts.presets?.length && opts.onPreset) {
      const { onPreset, presets } = opts;
      const select = h(
        'select',
        { class: 'preset-select', 'aria-label': 'Presets' },
        h('option', { value: '', text: 'Presets…' }),
        ...presets.map((p, i) => h('option', { value: String(i), text: p.name })),
      );
      select.addEventListener('change', () => {
        const preset = presets[Number(select.value)];
        select.value = '';
        if (preset) onPreset(preset);
      });
      actions.append(select);
    }
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

    const strip = opts.moduleStrip ? h('div', { class: 'module-strip' }) : null;
    if (strip) this.element.append(strip);

    for (const [name, defs] of groups) {
      const section = this.section(name, defs, opts);
      if (strip && section.chip) strip.append(section.chip);
      this.sections.push(section);
      this.element.append(section.element);
    }
    this.refreshSections();
    this.filter(this.query);
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
      const visible = s.element.querySelector('.param-row:not([hidden])') !== null;
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

    const chip = toggle
      ? h(
          'button',
          {
            class: 'module-chip',
            title: info?.description ?? name,
            onclick: () => {
              element.open = true;
              element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              element.classList.add('flash');
              setTimeout(() => element.classList.remove('flash'), 600);
            },
          },
          isIconName(info?.icon) ? icon(info.icon, 12) : null,
          h('span', { text: name }),
        )
      : null;
    return { name, element, toggle, checkbox, summary, info, chip };
  }

  /** Updates module headers (summary text, on/off look, chips) from current values. */
  private refreshSections(): void {
    for (const s of this.sections) {
      const on = !s.toggle || this.values[s.toggle.key] === true;
      s.element.classList.toggle('is-off', !on);
      s.chip?.classList.toggle('on', on);
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
    const wide = def.type === 'gradient';
    const element = h(
      'div',
      { class: `param-row${wide ? ' wide' : ''}`, 'data-key': def.key },
      label,
      h('div', { class: 'param-value' }, control.element),
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
