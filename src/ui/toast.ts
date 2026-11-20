import { h } from './dom';

let container: HTMLElement | null = null;

export function toast(message: string, kind: 'info' | 'error' = 'info', durationMs = 2800): void {
  if (!container) {
    container = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(container);
  }
  const el = h('div', { class: `toast toast-${kind}`, text: message });
  container.append(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, durationMs);
}
