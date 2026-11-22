import type { ImageParam, ParamValue } from '../../params/types';
import { isImageDataUrl } from '../../params/values';
import { pickFile } from '../../util/download';
import { h } from '../dom';
import { toast } from '../toast';
import type { ChangeHandler, Control } from './types';

/** Imported pictures are downscaled so documents, share links and autosave stay small. */
const MAX_IMAGE_SIZE = 1024;

/** Reads `file`, fits it in MAX_IMAGE_SIZE² and encodes it as a WebP data URL. */
async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const webp = canvas.toDataURL('image/webp', 0.92);
  return isImageDataUrl(webp) ? webp : canvas.toDataURL('image/png');
}

/** Thumbnail + "Load image…" / "Clear" buttons. Drop a file on it too. */
export function imageControl(
  def: ImageParam,
  initial: ParamValue,
  onChange: ChangeHandler,
): Control {
  let value = typeof initial === 'string' ? initial : def.default;
  const thumb = h('div', { class: 'image-thumb', title: def.label });
  const info = h('span', { class: 'image-info' });
  const clearBtn = h('button', {
    class: 'btn btn-small',
    text: 'Clear',
    onclick: () => set(''),
  });
  const load = async (file: File | null) => {
    if (!file) return;
    try {
      set(await fileToDataUrl(file));
    } catch (e) {
      toast(`Cannot read image: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  };
  const loadBtn = h('button', {
    class: 'btn btn-small',
    text: 'Load image…',
    onclick: () => void pickFile('image/*').then(load),
  });
  const element = h(
    'div',
    { class: 'control-image' },
    thumb,
    h('div', { class: 'image-actions' }, loadBtn, clearBtn, info),
  );
  element.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
  });
  element.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    e.preventDefault();
    void load(file);
  });

  function render(): void {
    // The checker comes from CSS; only the picture layer is set here.
    thumb.style.backgroundImage = value ? `url("${value}")` : '';
    thumb.classList.toggle('empty', !value);
    clearBtn.disabled = !value;
    info.textContent = value ? `${Math.round((value.length * 3) / 4 / 1024)} KB` : 'No image';
  }

  function set(v: string): void {
    value = v;
    render();
    onChange(v);
  }

  render();
  return {
    element,
    setValue: (v) => {
      if (typeof v !== 'string' || v === value) return;
      value = v;
      render();
    },
  };
}
