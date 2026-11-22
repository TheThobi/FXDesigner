import { h } from './dom';
import { icon, type IconName } from './icons';

export type ExportKind = 'png' | 'maps' | 'flipbook' | 'nodes' | 'json' | 'share';

export interface ExportChoice {
  readonly kind: ExportKind;
  readonly icon: IconName;
  readonly title: string;
  readonly description: string;
  /** Short facts (size, node…) shown under the description. */
  readonly detail?: string;
  /** Why the option is unavailable (shown instead of enabling it). */
  readonly disabled?: string;
}

/**
 * Export window: every way to get something out of FX Designer, each with what it produces.
 * Resolves the chosen kind (its own settings window may follow), or null when cancelled.
 */
export function askExport(
  title: string,
  sections: readonly { readonly label: string; readonly choices: readonly ExportChoice[] }[],
): Promise<ExportKind | null> {
  return new Promise((resolve) => {
    let picked: ExportKind | null = null;
    const dialog = h('dialog', { class: 'dialog export-hub' });
    const card = (c: ExportChoice) =>
      h(
        'button',
        {
          type: 'button',
          class: 'export-choice',
          'data-kind': c.kind,
          disabled: c.disabled !== undefined,
          title: c.disabled ?? '',
          onclick: () => {
            picked = c.kind;
            dialog.close();
          },
        },
        h('span', { class: 'export-choice-icon' }, icon(c.icon, 22)),
        h(
          'span',
          { class: 'export-choice-text' },
          h('span', { class: 'export-choice-title', text: c.title }),
          h('span', { class: 'export-choice-desc', text: c.description }),
          c.detail || c.disabled
            ? h('span', { class: 'export-choice-detail', text: c.disabled ?? c.detail ?? '' })
            : null,
        ),
      );
    dialog.append(
      h(
        'div',
        { class: 'library-head' },
        h('h2', { text: 'Export' }),
        h('span', { class: 'export-hub-subject', text: title }),
        h(
          'button',
          {
            type: 'button',
            class: 'panel-close',
            title: 'Close',
            'aria-label': 'Close',
            onclick: () => dialog.close(),
          },
          icon('close', 12),
        ),
      ),
      ...sections.map((s) =>
        h(
          'section',
          { class: 'export-section' },
          h('h3', { text: s.label }),
          h('div', { class: 'export-choices' }, ...s.choices.map(card)),
        ),
      ),
    );
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(picked);
    });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('.export-choice:not(:disabled)')?.focus();
  });
}
