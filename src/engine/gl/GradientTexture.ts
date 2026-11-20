import { activateUploadUnit } from './units';
import {
  bakeGradient,
  gradientKey,
  GRADIENT_BAKE_WIDTH,
  type GradientValue,
} from '../../params/gradient';

/** 256x1 RGBA8 lookup texture, re-uploaded only when the gradient actually changes. */
export class GradientTexture {
  readonly texture: WebGLTexture;
  private key = '';

  constructor(private readonly gl: WebGL2RenderingContext) {
    const tex = gl.createTexture();
    if (!tex) throw new Error('Failed to create gradient texture');
    this.texture = tex;
    activateUploadUnit(gl);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  update(gradient: GradientValue): WebGLTexture {
    const key = gradientKey(gradient);
    if (key !== this.key) {
      const { gl } = this;
      activateUploadUnit(gl);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        GRADIENT_BAKE_WIDTH,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bakeGradient(gradient),
      );
      this.key = key;
    }
    return this.texture;
  }

  dispose(): void {
    this.gl.deleteTexture(this.texture);
  }
}

/** One GradientTexture per named slot (e.g. "post", "gen:fire:ramp"). */
export class GradientTextureCache {
  private readonly slots = new Map<string, GradientTexture>();

  constructor(private readonly gl: WebGL2RenderingContext) {}

  get(slot: string, gradient: GradientValue): WebGLTexture {
    let tex = this.slots.get(slot);
    if (!tex) {
      tex = new GradientTexture(this.gl);
      this.slots.set(slot, tex);
    }
    return tex.update(gradient);
  }

  dispose(): void {
    for (const tex of this.slots.values()) tex.dispose();
    this.slots.clear();
  }
}
