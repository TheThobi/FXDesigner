import type { Preset } from '../params/types';
import { h } from './dom';
import { icon } from './icons';
import { attachPopover } from './popover';

export interface UserPresetActions {
  readonly list: () => readonly Preset[];
  readonly save: () => void;
  readonly apply: (preset: Preset) => void;
  readonly rename: (preset: Preset) => void;
  readonly remove: (preset: Preset) => void;
}

/** "My presets" button: save the current settings, apply / rename / delete saved ones. */
export function userPresetMenu(actions: UserPresetActions): HTMLElement {
  const button = h(
    'button',
    { class: 'btn btn-small', title: 'My presets: save, apply, rename or delete your presets' },
    icon('save', 12),
    'My presets',
  );
  const panel = h('div', { class: 'menu-panel user-preset-menu', role: 'menu' });
  const root = h('div', { class: 'menu-root' }, button, panel);
  const popover = attachPopover(root, button, panel, () => build());
  const run = (fn: () => void) => () => {
    popover.close();
    fn();
  };
  function build(): void {
    const presets = actions.list();
    const children: (HTMLElement | null)[] = [
      h(
        'button',
        { class: 'menu-item', role: 'menuitem', onclick: run(actions.save) },
        h('span', { class: 'menu-check' }, icon('save', 14)),
        h('span', { text: 'Save current settings…' }),
      ),
      presets.length > 0 ? h('div', { class: 'menu-sep' }) : null,
      ...presets.map((p) =>
        h(
          'div',
          { class: 'user-preset-row' },
          h('button', {
            class: 'menu-item user-preset-name',
            role: 'menuitem',
            text: p.name,
            title: `Apply "${p.name}"`,
            onclick: run(() => actions.apply(p)),
          }),
          h('button', {
            class: 'icon-btn',
            text: '✎',
            title: 'Rename',
            onclick: run(() => actions.rename(p)),
          }),
          h('button', {
            class: 'icon-btn',
            text: '✕',
            title: 'Delete',
            onclick: run(() => actions.remove(p)),
          }),
        ),
      ),
      presets.length === 0 ? h('p', { class: 'menu-empty', text: 'No saved preset yet.' }) : null,
    ];
    panel.replaceChildren(...children.filter((c): c is HTMLElement => c !== null));
  }
  return root;
}
