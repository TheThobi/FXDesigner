import { readStorage, writeStorage } from '../util/storage';
import { h } from './dom';

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  /** When set, a "Don't ask again" box is shown; once ticked the dialog resolves true at once. */
  readonly dontAskKey?: string;
}

const DONT_ASK_PREFIX = 'ptm.ui.dontAsk.';

/** Modal yes / no question. Resolves true when confirmed. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  const storageKey = opts.dontAskKey ? DONT_ASK_PREFIX + opts.dontAskKey : null;
  if (storageKey && readStorage(storageKey) === '1') return Promise.resolve(true);

  return new Promise((resolve) => {
    const dontAsk = h('input', { type: 'checkbox', name: 'dontAsk' });
    const form = h(
      'form',
      { method: 'dialog' },
      h('h2', { text: opts.title }),
      h('p', { class: 'dialog-info', text: opts.message }),
      storageKey
        ? h('label', { class: 'dialog-check' }, dontAsk, h('span', { text: "Don't ask again" }))
        : null,
      h(
        'div',
        { class: 'dialog-buttons' },
        h('button', {
          type: 'button',
          class: 'btn',
          text: 'Cancel',
          onclick: () => dialog.close('cancel'),
        }),
        h('button', {
          type: 'submit',
          class: 'btn btn-primary',
          value: 'ok',
          text: opts.confirmLabel ?? 'OK',
        }),
      ),
    );
    const dialog = h('dialog', { class: 'dialog' }, form);
    dialog.addEventListener('close', () => {
      const ok = dialog.returnValue === 'ok';
      if (ok && storageKey && dontAsk.checked) writeStorage(storageKey, '1');
      dialog.remove();
      resolve(ok);
    });
    document.body.append(dialog);
    dialog.showModal();
    (form.querySelector('.btn-primary') as HTMLButtonElement | null)?.focus();
  });
}

export interface PromptOptions {
  readonly title: string;
  readonly label: string;
  readonly value?: string;
  readonly confirmLabel?: string;
}

/** Modal text question. Resolves the trimmed text, or null when cancelled / empty. */
export function promptDialog(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const input = h('input', {
      type: 'text',
      name: 'value',
      class: 'dialog-text',
      maxLength: 64,
      required: true,
    });
    input.value = opts.value ?? '';
    const form = h(
      'form',
      { method: 'dialog' },
      h('h2', { text: opts.title }),
      h('label', { class: 'dialog-field' }, h('span', { text: opts.label }), input),
      h(
        'div',
        { class: 'dialog-buttons' },
        h('button', {
          type: 'button',
          class: 'btn',
          text: 'Cancel',
          onclick: () => dialog.close('cancel'),
        }),
        h('button', {
          type: 'submit',
          class: 'btn btn-primary',
          value: 'ok',
          text: opts.confirmLabel ?? 'OK',
        }),
      ),
    );
    const dialog = h('dialog', { class: 'dialog' }, form);
    dialog.addEventListener('close', () => {
      const text = input.value.trim();
      dialog.remove();
      resolve(dialog.returnValue === 'ok' && text ? text : null);
    });
    document.body.append(dialog);
    dialog.showModal();
    input.select();
  });
}
