import type { GpuContext } from './GpuContext';
import { activateUploadUnit } from './units';

interface Entry {
  texture: WebGLTexture | null;
  width: number;
  height: number;
  failed: boolean;
}

const MAX_IMAGES = 16;

/**
 * GPU textures of imported images (data URLs), decoded asynchronously. `get` returns null until
 * the image is ready; `onLoad` fires when one becomes available so callers can re-render.
 */
export class ImageTextures {
  private readonly entries = new Map<string, Entry>();
  onLoad: (() => void) | null = null;

  constructor(private readonly gpu: GpuContext) {}

  /** Waits for the textures needed by an offscreen capture. */
  async preload(urls: readonly string[]): Promise<void> {
    const unique = [...new Set(urls.filter(Boolean))];
    if (unique.length > MAX_IMAGES) throw new Error('Too many images for a community preview');
    unique.forEach((url) => this.get(url));
    const deadline = performance.now() + 10_000;
    while (unique.some((url) => !this.entries.get(url)?.texture)) {
      if (unique.some((url) => this.entries.get(url)?.failed) || performance.now() > deadline)
        throw new Error('Could not load an image for the community preview');
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }

  get(url: string): { texture: WebGLTexture; width: number; height: number } | null {
    if (!url) return null;
    let entry = this.entries.get(url);
    if (!entry) {
      entry = { texture: null, width: 0, height: 0, failed: false };
      this.entries.set(url, entry);
      this.load(url, entry);
      this.evict();
    }
    return entry.texture
      ? { texture: entry.texture, width: entry.width, height: entry.height }
      : null;
  }

  private load(url: string, entry: Entry): void {
    const image = new Image();
    if (!url.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
      image.referrerPolicy = 'no-referrer';
    }
    image.onload = () => {
      if (this.entries.get(url) !== entry) return; // evicted meanwhile
      entry.texture = this.gpu.createImageTexture(image, 'linear');
      const { gl } = this.gpu;
      activateUploadUnit(gl);
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      entry.width = image.naturalWidth;
      entry.height = image.naturalHeight;
      this.onLoad?.();
    };
    image.onerror = () => {
      entry.failed = true;
    };
    image.src = url;
  }

  /** Keeps the most recent MAX_IMAGES entries. */
  private evict(): void {
    while (this.entries.size > MAX_IMAGES) {
      const [oldest, entry] = this.entries.entries().next().value as [string, Entry];
      if (entry.texture) this.gpu.gl.deleteTexture(entry.texture);
      this.entries.delete(oldest);
    }
  }

  dispose(): void {
    for (const e of this.entries.values()) if (e.texture) this.gpu.gl.deleteTexture(e.texture);
    this.entries.clear();
  }
}
