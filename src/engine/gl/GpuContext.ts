import vertexSource from '../glsl/fullscreen.vert?raw';
import { PingPong, RenderTarget, type TargetFormat, type TargetOptions } from './RenderTarget';
import { ShaderProgram } from './ShaderProgram';
import { activateUploadUnit } from './units';

export interface GpuCapabilities {
  /** RGBA32F / RGBA16F are renderable (EXT_color_buffer_float). */
  readonly floatTargets: boolean;
  /** RGBA16F is renderable (EXT_color_buffer_half_float or the above). */
  readonly halfFloatTargets: boolean;
  readonly maxTextureSize: number;
  readonly renderer: string;
}

export class WebGL2UnavailableError extends Error {
  constructor() {
    super('WebGL2 is not available in this browser.');
    this.name = 'WebGL2UnavailableError';
  }
}

/** Owns the WebGL2 context and the few resources shared by every pass. */
export class GpuContext {
  readonly gl: WebGL2RenderingContext;
  readonly caps: GpuCapabilities;
  private readonly vao: WebGLVertexArrayObject;
  private blank: WebGLTexture | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new WebGL2UnavailableError();
    this.gl = gl;

    const floatTargets = gl.getExtension('EXT_color_buffer_float') !== null;
    const halfFloatTargets =
      floatTargets || gl.getExtension('EXT_color_buffer_half_float') !== null;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    this.caps = {
      floatTargets,
      halfFloatTargets,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      renderer: debugInfo
        ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER)),
    };

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    this.vao = vao;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  /** Best format for simulation state (precision matters more than filtering). */
  get precisionFormat(): TargetFormat {
    return this.caps.floatTargets ? 'rgba32f' : this.caps.halfFloatTargets ? 'rgba16f' : 'rgba8';
  }

  /** Format for intermediate images: HDR-capable and linearly filterable. */
  get imageFormat(): TargetFormat {
    return this.caps.halfFloatTargets ? 'rgba16f' : 'rgba8';
  }

  createProgram(fragmentSource: string, label: string): ShaderProgram {
    return new ShaderProgram(this.gl, vertexSource, fragmentSource, label);
  }

  /** Program with a custom vertex shader (e.g. point sprites driven by a data texture). */
  createProgramWithVertex(vertex: string, fragmentSource: string, label: string): ShaderProgram {
    return new ShaderProgram(this.gl, vertex, fragmentSource, label);
  }

  createTarget(options: TargetOptions): RenderTarget {
    return new RenderTarget(this.gl, options);
  }

  createPingPong(options: TargetOptions): PingPong {
    return new PingPong(this.gl, options);
  }

  /** Binds `target` (or the canvas when null) as draw destination and sets the viewport. */
  bindTarget(target: RenderTarget | null): void {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
    if (target) gl.viewport(0, 0, target.width, target.height);
    else gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  drawFullscreen(): void {
    const { gl } = this;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /** Draws `count` points (vertex shader uses gl_VertexID), optionally additively blended. */
  drawPoints(count: number, additive = false): void {
    const { gl } = this;
    if (additive) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
    }
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
    if (additive) gl.disable(gl.BLEND);
  }

  /** Clears `target` to the given color. */
  clearTarget(
    target: RenderTarget,
    color: readonly [number, number, number, number] = [0, 0, 0, 0],
  ): void {
    const { gl } = this;
    this.bindTarget(target);
    gl.clearColor(color[0], color[1], color[2], color[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Copies `source` into `dest` (same size and format), e.g. to snapshot simulation state. */
  copyTarget(source: RenderTarget, dest: RenderTarget): void {
    const { gl } = this;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dest.framebuffer);
    gl.blitFramebuffer(
      0,
      0,
      source.width,
      source.height,
      0,
      0,
      dest.width,
      dest.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  /** New target with the same size/format as `source`, holding a copy of its pixels. */
  cloneTarget(source: RenderTarget): RenderTarget {
    const copy = this.createTarget(source.options);
    this.copyTarget(source, copy);
    return copy;
  }

  /** Reads RGBA8 pixels of `target` (bottom-up row order, as GL returns them). */
  readPixels(target: RenderTarget): Uint8Array {
    const { gl } = this;
    const out = new Uint8Array(target.width * target.height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.readPixels(0, 0, target.width, target.height, gl.RGBA, gl.UNSIGNED_BYTE, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return out;
  }

  /**
   * 1x1 transparent black texture. Bind it to samplers that have nothing to read: an unbound
   * sampler defaults to unit 0, which may hold the current render target (feedback loop error).
   */
  get blankTexture(): WebGLTexture {
    if (!this.blank) {
      const { gl } = this;
      const tex = gl.createTexture();
      if (!tex) throw new Error('Failed to create texture');
      activateUploadUnit(gl);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(4),
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      this.blank = tex;
    }
    return this.blank;
  }

  /** Creates an RGBA8 texture from a canvas/image (flipped so uv (0,0) is bottom-left). */
  createImageTexture(
    source: TexImageSource,
    filter: 'nearest' | 'linear' = 'linear',
  ): WebGLTexture {
    const { gl } = this;
    const tex = gl.createTexture();
    if (!tex) throw new Error('Failed to create texture');
    activateUploadUnit(gl);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const f = filter === 'linear' ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  dispose(): void {
    if (this.blank) this.gl.deleteTexture(this.blank);
    this.gl.deleteVertexArray(this.vao);
  }
}
