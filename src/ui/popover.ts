/**
 * Attaches a dropdown popover to `button`: toggles on click, closes on Escape or outside
 * click. `build` runs on every open so the content reflects the current state.
 */
export function attachPopover(
  root: HTMLElement,
  button: HTMLButtonElement,
  panel: HTMLElement,
  build: () => void,
): { close(): void } {
  panel.hidden = true;
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  const onOutside = (e: PointerEvent) => {
    if (!root.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    close();
    button.focus();
  };
  function open() {
    build();
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
  }
  function close() {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
  }
  button.addEventListener('click', () => (panel.hidden ? open() : close()));
  return { close };
}
