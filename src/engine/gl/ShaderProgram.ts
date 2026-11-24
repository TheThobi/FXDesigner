export type UniformValue = number | boolean | readonly number[];

/** Thrown when a shader fails to compile/link; carries the log and an annotated excerpt. */
export class ShaderCompileError extends Error {
  constructor(
    readonly label: string,
    readonly log: string,
    readonly source: string,
  ) {
    super(`Shader "${label}" failed to compile:\n${log}`);
    this.name = 'ShaderCompileError';
  }

  /** Log followed by the offending source lines (±2 lines of context). */
  annotated(): string {
    const lines = this.source.split('\n');
    const errorLines = new Set<number>();
    for (const m of this.log.matchAll(/ERROR:\s*\d+:(\d+)/g)) errorLines.add(Number(m[1]));
    const excerpt: string[] = [];
    for (const ln of [...errorLines].sort((a, b) => a - b)) {
      for (let i = Math.max(1, ln - 2); i <= Math.min(lines.length, ln + 2); i++) {
        excerpt.push(`${i === ln ? '>' : ' '}${String(i).padStart(4)} | ${lines[i - 1] ?? ''}`);
      }
      excerpt.push('');
    }
    return `${this.log.trim()}\n\n${excerpt.join('\n')}`;
  }
}

interface UniformInfo {
  readonly location: WebGLUniformLocation;
  readonly type: number;
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
  label: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('gl.createShader failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown error';
    gl.deleteShader(shader);
    throw new ShaderCompileError(label, log, source);
  }
  return shader;
}

/**
 * A linked program with reflection-based uniform setters: callers pass plain values and the
 * correct gl.uniform* call is picked from the declared GLSL type. Unknown or optimized-out
 * uniforms are silently ignored.
 */
export class ShaderProgram {
  readonly program: WebGLProgram;
  private readonly uniforms = new Map<string, UniformInfo>();

  constructor(
    private readonly gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
    readonly label: string,
    /** Already compiled and linked (see PendingProgram). */
    linked?: WebGLProgram,
  ) {
    let program: WebGLProgram;
    if (linked) program = linked;
    else {
      const vs = compile(gl, gl.VERTEX_SHADER, vertexSource, `${label} (vertex)`);
      const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource, label);
      const p = gl.createProgram();
      if (!p) throw new Error('gl.createProgram failed');
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
        const log = gl.getProgramInfoLog(p) ?? 'unknown error';
        gl.deleteProgram(p);
        throw new ShaderCompileError(label, log, fragmentSource);
      }
      program = p;
    }
    this.program = program;

    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      if (!info) continue;
      const location = gl.getUniformLocation(program, info.name);
      if (location)
        this.uniforms.set(info.name.replace(/\[0\]$/, ''), { location, type: info.type });
    }
  }

  use(): this {
    this.gl.useProgram(this.program);
    return this;
  }

  has(name: string): boolean {
    return this.uniforms.has(name);
  }

  /** Program must be in use. */
  set(name: string, value: UniformValue): this {
    const info = this.uniforms.get(name);
    if (!info) return this;
    const { gl } = this;
    const { location, type } = info;
    const arr = typeof value === 'object' ? (value as readonly number[]) : null;
    const n = typeof value === 'boolean' ? Number(value) : (value as number);
    switch (type) {
      case gl.FLOAT:
        gl.uniform1f(location, n);
        break;
      case gl.INT:
      case gl.BOOL:
      case gl.SAMPLER_2D:
        gl.uniform1i(location, Math.round(n));
        break;
      case gl.FLOAT_VEC2:
        if (arr) gl.uniform2f(location, arr[0] ?? 0, arr[1] ?? 0);
        break;
      case gl.FLOAT_VEC3:
        if (arr) gl.uniform3f(location, arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0);
        break;
      case gl.FLOAT_VEC4:
        if (arr) gl.uniform4f(location, arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0, arr[3] ?? 0);
        break;
      case gl.FLOAT_MAT4:
        if (arr?.length === 16) gl.uniformMatrix4fv(location, false, arr as number[]);
        break;
      default:
        throw new Error(`Unsupported uniform type 0x${type.toString(16)} for ${name}`);
    }
    return this;
  }

  setAll(values: Readonly<Record<string, UniformValue>>): this {
    for (const [name, value] of Object.entries(values)) this.set(name, value);
    return this;
  }

  /** Binds `texture` to `unit` and points sampler `name` at it. Program must be in use. */
  texture(name: string, texture: WebGLTexture, unit: number): this {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    return this.set(name, unit);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.uniforms.clear();
  }
}

/** KHR_parallel_shader_compile: COMPLETION_STATUS_KHR. */
const COMPLETION_STATUS = 0x91b1;

/**
 * A program compiled without blocking the main thread (KHR_parallel_shader_compile): user
 * code is compiled in the background while the rest of the graph keeps rendering. Without the
 * extension it behaves like a normal (blocking) compile on the first poll.
 */
export class PendingProgram {
  private readonly vs: WebGLShader;
  private readonly fs: WebGLShader;
  private readonly program: WebGLProgram;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly parallel: boolean,
    private readonly vertexSource: string,
    private readonly fragmentSource: string,
    readonly label: string,
  ) {
    const shader = (type: number, source: string) => {
      const s = gl.createShader(type);
      if (!s) throw new Error('gl.createShader failed');
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };
    this.vs = shader(gl.VERTEX_SHADER, vertexSource);
    this.fs = shader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('gl.createProgram failed');
    gl.attachShader(program, this.vs);
    gl.attachShader(program, this.fs);
    gl.linkProgram(program);
    this.program = program;
  }

  /**
   * The program once ready (null while compiling); throws ShaderCompileError on failure.
   * `wait`: blocks until the compile is done instead of returning null.
   */
  poll(wait = false): ShaderProgram | null {
    const { gl } = this;
    if (!wait && this.parallel && !gl.getProgramParameter(this.program, COMPLETION_STATUS))
      return null;
    try {
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS) && !gl.isContextLost()) {
        const fsLog = gl.getShaderInfoLog(this.fs);
        const vsLog = gl.getShaderInfoLog(this.vs);
        const log = fsLog || vsLog || gl.getProgramInfoLog(this.program) || 'unknown error';
        gl.deleteProgram(this.program);
        throw new ShaderCompileError(this.label, log, this.fragmentSource);
      }
      return new ShaderProgram(
        gl,
        this.vertexSource,
        this.fragmentSource,
        this.label,
        this.program,
      );
    } finally {
      gl.deleteShader(this.vs);
      gl.deleteShader(this.fs);
    }
  }
}
