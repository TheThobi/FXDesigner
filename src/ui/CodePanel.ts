import { h } from './dom';
import { icon } from './icons';
import { ParamEditor, type ParamEditorOptions } from './ParamEditor';

export interface CodePanelOptions {
  /** Current GLSL of the node (its own code, or the generator's). */
  readonly code: string;
  /** True when the code differs from the generator's: the node is custom. */
  readonly modified: boolean;
  /** What the code can use (built-ins, uniforms, helpers), as commented GLSL. */
  readonly reference: string;
  /** Edited code (debounced while typing). */
  readonly onChange: (code: string) => void;
  /** Back to the generator's own code. */
  readonly onRevert: () => void;
  /** Parameters created for this node (shown above the code). */
  readonly params: ParamEditorOptions;
}

const EDIT_DELAY_MS = 450;

/**
 * GLSL view of a shader node: the `generate(uv)` function the node runs, editable. Editing it
 * turns the node into a custom node (its parameters stay, as uniforms); Revert brings the
 * generator's code back. Tab indents, Ctrl+Enter applies at once.
 */
export class CodePanel {
  readonly element: HTMLElement;
  private readonly textarea: HTMLTextAreaElement;
  private readonly status: HTMLElement;
  private readonly revertBtn: HTMLButtonElement;
  private readonly reference: HTMLElement;
  private readonly paramEditor = new ParamEditor();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private opts: CodePanelOptions | null = null;

  constructor() {
    this.textarea = h('textarea', {
      class: 'code-input code-editor',
      spellcheck: false,
      'aria-label': 'GLSL code',
      wrap: 'off',
    });
    this.status = h('span', { class: 'code-status' });
    this.revertBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-small',
        title: 'Back to the generator code (the node is no longer custom)',
        onclick: () => this.opts?.onRevert(),
      },
      icon('reset', 12),
      'Revert',
    );
    const copyBtn = h('button', {
      type: 'button',
      class: 'btn btn-small',
      text: 'Copy',
      title: 'Copy the code',
      onclick: () => void navigator.clipboard?.writeText(this.textarea.value),
    });
    this.reference = h('pre', { class: 'code-reference' });
    this.element = h(
      'section',
      { class: 'code-panel' },
      this.paramEditor.element,
      h('div', { class: 'code-head' }, this.status, copyBtn, this.revertBtn),
      this.textarea,
      h(
        'details',
        { class: 'code-ref-box' },
        h('summary', { text: 'Available uniforms and helpers' }),
        this.reference,
      ),
    );
    this.textarea.addEventListener('input', () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), EDIT_DELAY_MS);
    });
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const { selectionStart: a, selectionEnd: b, value } = this.textarea;
        this.textarea.value = `${value.slice(0, a)}  ${value.slice(b)}`;
        this.textarea.selectionStart = this.textarea.selectionEnd = a + 2;
        this.textarea.dispatchEvent(new Event('input'));
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.flush();
      }
    });
  }

  render(opts: CodePanelOptions): void {
    this.opts = opts;
    clearTimeout(this.timer);
    if (this.textarea.value !== opts.code && document.activeElement !== this.textarea)
      this.textarea.value = opts.code;
    this.reference.textContent = opts.reference;
    this.paramEditor.render(opts.params);
    this.setModified(opts.modified);
  }

  setModified(modified: boolean): void {
    this.status.textContent = modified ? 'Custom code' : 'Generator code (edit to customize)';
    this.status.classList.toggle('modified', modified);
    this.revertBtn.disabled = !modified;
  }

  private flush(): void {
    clearTimeout(this.timer);
    this.opts?.onChange(this.textarea.value);
  }
}
