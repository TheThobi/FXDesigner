import type { ParamDef, ParamValue, ParamValues, Preset } from '../params/types';
import { createControl, type Control } from './controls';
import { clear, h } from './dom';

export interface ParamPanelOptions {
  readonly defs: readonly ParamDef[];
  readonly values: ParamValues;
  readonly presets?: readonly Preset[];
  readonly onChange: (key: string, value: ParamValue) => void;
  readonly onPreset?: (preset: Preset) => void;
  readonly onReset?: () => void;
}

const DEFAULT_GROUP = 'General';

/** Schema-driven parameter editor, grouped in collapsible sections. */
export class ParamPanel {
  private controls = new Map<string, Control>();
  private collapsed = new Set<string>();

  constructor(readonly element: HTMLElement) {
    element.classList.add('param-panel');
  }

  render(opts: ParamPanelOptions): void {
    clear(this.element);
    this.controls.clear();

    const header = h('div', { class: 'panel-actions' });
    if (opts.presets?.length && opts.onPreset) {
      const onPreset = opts.onPreset;
      const presets = opts.presets;
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
      header.append(select);
    }
    if (opts.onReset) {
      header.append(
        h('button', {
          class: 'btn btn-small',
          text: 'Reset',
          title: 'Restore defaults',
          onclick: opts.onReset,
        }),
      );
    }
    if (header.childElementCount > 0) this.element.append(header);

    const groups = new Map<string, ParamDef[]>();
    for (const def of opts.defs) {
      const g = def.group ?? DEFAULT_GROUP;
      groups.set(g, [...(groups.get(g) ?? []), def]);
    }

    for (const [name, defs] of groups) {
      const section = h('details', { class: 'param-group', open: !this.collapsed.has(name) });
      section.addEventListener('toggle', () => {
        if (section.open) this.collapsed.delete(name);
        else this.collapsed.add(name);
      });
      section.append(h('summary', { text: name }));
      for (const def of defs) section.append(this.row(def, opts));
      this.element.append(section);
    }
  }

  /** Pushes new values into existing widgets (no rebuild, no change events). */
  setValues(values: ParamValues): void {
    for (const [key, control] of this.controls) {
      const v = values[key];
      if (v !== undefined) control.setValue(v);
    }
  }

  private row(def: ParamDef, opts: ParamPanelOptions): HTMLElement {
    const control = createControl(def, opts.values[def.key] ?? def.default, (v) =>
      opts.onChange(def.key, v),
    );
    this.controls.set(def.key, control);
    const label = h('label', {
      class: 'param-label',
      text: def.label,
      title: [def.description, 'Double-click to reset'].filter(Boolean).join('\n'),
    });
    label.addEventListener('dblclick', () => {
      control.setValue(def.default);
      opts.onChange(def.key, def.default);
    });
    const wide = def.type === 'gradient' || def.type === 'vec2';
    return h(
      'div',
      { class: `param-row${wide ? ' wide' : ''}`, 'data-key': def.key },
      label,
      control.element,
    );
  }
}
