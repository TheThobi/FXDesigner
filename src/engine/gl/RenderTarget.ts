import { activateUploadUnit } from './units';

export type TargetFormat = 'rgba8' | 'rgba16f' | 'rgba32f';

export interface TargetOptions {
  readonly width: number;
  readonly height: number;
  readonly format: TargetFormat;
  readonly filter?: 'nearest' | 'linear';
  readonly wrap?: 'clamp' | 'repeat';
}

interface FormatInfo {
  internalFormat: number;
  type: number;
}

function formatInfo(gl: WebGL2RenderingContext, format: TargetFormat): FormatInfo {
  switch (format) {
    case 'rgba8':
      return { internalFormat: gl.RGBA8, type: gl.UNSIGNED_BYTE };
    case 'rgba16f':
      return { internalFormat: gl.RGBA16F, type: gl.HALF_FLOAT };
    case 'rgba32f':
      return { internalFormat: gl.RGBA32F, type: gl.FLOAT };
  }
}

/** A texture with an attached framebuffer, usable both as render destination and sampler. */
export class RenderTarget {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  private _width = 0;
  private _height = 0;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly options: TargetOptions,
  ) {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) throw new Error('Failed to allocate render target');
    this.texture = texture;
    this.framebuffer = framebuffer;

    // 32-bit float textures are not filterable without OES_texture_float_linear.
    const linear = options.filter === 'linear' && options.format !== 'rgba32f';
    const filter = linear ? gl.LINEAR : gl.NEAREST;
    const wrap = options.wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    activateUploadUnit(gl);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    this.resize(options.width, options.height);
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get format(): TargetFormat {
    return this.options.format;
  }

  resize(width: number, height: number): void {
    if (width === this._width && height === this._height) return;
    const { gl } = this;
    const { internalFormat, type } = formatInfo(gl, this.options.format);
    activateUploadUnit(gl);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, type, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) {
      throw new Error(
        `Framebuffer incomplete (0x${status.toString(16)}) for format ${this.options.format}`,
      );
    }
    this._width = width;
    this._height = height;
  }

  dispose(): void {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteFramebuffer(this.framebuffer);
  }
}

/** Double-buffered targets for iterative GPU simulations (read from one, write the other). */
export class PingPong {
  private targets: [RenderTarget, RenderTarget];

  constructor(gl: WebGL2RenderingContext, options: TargetOptions) {
    this.targets = [new RenderTarget(gl, options), new RenderTarget(gl, options)];
  }

  get read(): RenderTarget {
    return this.targets[0];
  }

  get write(): RenderTarget {
    return this.targets[1];
  }

  get width(): number {
    return this.targets[0].width;
  }

  swap(): void {
    this.targets = [this.targets[1], this.targets[0]];
  }

  dispose(): void {
    this.targets[0].dispose();
    this.targets[1].dispose();
  }
}
