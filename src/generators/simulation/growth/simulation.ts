import type { Simulation, SimulationPointer, SimulationSnapshot } from '../../../engine/generator';
import type { GpuContext } from '../../../engine/gl/GpuContext';
import type { RenderTarget } from '../../../engine/gl/RenderTarget';
import { activateUploadUnit } from '../../../engine/gl/units';
import { SHADER_HEADER } from '../../../engine/shaderBuilder';
import { SimProgram } from '../../../engine/simulation/GridSimulation';
import type { ParamValues } from '../../../params/types';
import { getNumber } from '../../../params/values';
import segmentFrag from './segment.frag?raw';
import segmentVert from './segment.vert?raw';

/** Segment texture width (rows grow with the segment count). */
const TEX_WIDTH = 256;
/** Hard cap on nodes (arrays are allocated once at this size, grown on demand). */
const NODE_LIMIT = 30000;

interface GrowthSnapshot extends SimulationSnapshot {
  readonly owner: DifferentialGrowth;
  readonly count: number;
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  readonly next: Int32Array;
  readonly prev: Int32Array;
}

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shortest torus offset. */
const wrap = (d: number) => d - Math.round(d);
/** Back into [0, 1). */
const unit = (v: number) => v - Math.floor(v);

/**
 * Differential growth (after Anders Hoff / Jason Webb): closed curves whose nodes repel all
 * nearby nodes and are pulled toward their neighbours' midpoint. Edges that stretch split,
 * so the curves lengthen and fold into coral / brain-like meanders. CPU on typed arrays (rings
 * as prev / next links, spatial hash, no allocation per step), drawn as anti-aliased GPU
 * segments. Seamless (unit torus): only segments near an edge are drawn twice or more.
 */
export class DifferentialGrowth implements Simulation {
  private count = 0;
  private xs = new Float64Array(1024);
  private ys = new Float64Array(1024);
  private next = new Int32Array(1024);
  private prev = new Int32Array(1024);
  /** Positions after the force step (swapped with xs / ys). */
  private nx = new Float64Array(1024);
  private ny = new Float64Array(1024);
  /** Spatial hash: first node per cell, and the next node of the same cell. */
  private head = new Int32Array(0);
  private chain = new Int32Array(1024);
  private random = rng(1);
  private texture: WebGLTexture | null = null;
  private texRows = 0;
  private segments = new Float32Array(0);
  private segmentCount = 0;
  private uploaded = false;
  private lastSpawn: readonly [number, number] | null = null;
  /**
   * The node budget is reached and the curves barely move: steps are skipped (an idle
   * pattern costs nothing) until something wakes it (reset, paint, restore, bigger budget).
   */
  private settled = false;
  private readonly program: SimProgram;

  constructor(private readonly gpu: GpuContext) {
    this.program = new SimProgram(
      gpu,
      'growth/segment',
      `${SHADER_HEADER}\n${segmentFrag}`,
      `${SHADER_HEADER}\n${segmentVert}`,
    );
  }

  ready(): boolean {
    return this.program.ready();
  }

  reset(params: ParamValues, seed: number): void {
    this.random = rng(seed + 1);
    this.count = 0;
    this.settled = false;
    const start = getNumber(params, 'start');
    const r = getNumber(params, 'radius', 0.012);
    if (start === 1) {
      for (let i = 0; i < 5; i++) this.addRing(this.random(), this.random(), r * 3, r);
    } else if (start === 2) {
      // A wavy line wrapping around the torus (closed through the edge).
      const n = Math.ceil(1 / (r * 0.6));
      const first = this.count;
      for (let i = 0; i < n; i++)
        this.addNode(i / n, unit(0.5 + Math.sin((i / n) * Math.PI * 6) * r * 2));
      this.closeRing(first);
    } else {
      this.addRing(0.5, 0.5, r * 4, r);
    }
    this.uploaded = false;
  }

  step(params: ParamValues): void {
    if (this.settled && this.count >= getNumber(params, 'maxNodes', 8000)) return;
    this.settled = false;
    const iterations = getNumber(params, 'stepsPerFrame', 1);
    for (let i = 0; i < iterations && !this.settled; i++) this.iterate(params);
    this.uploaded = false;
  }

  render(target: RenderTarget, params: ParamValues): void {
    const { gpu } = this;
    const { gl } = gpu;
    this.upload(target.width, target.height, params);
    gpu.clearTarget(target);
    if (!this.texture || this.segmentCount === 0) return;
    this.program
      .get()
      .use()
      .set('u_width', TEX_WIDTH)
      .set('u_size', [target.width, target.height])
      .set('u_halfWidth', this.halfWidth(target.width, params))
      .texture('u_nodes', this.texture, 0);
    gpu.bindTarget(target);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    gpu.drawTriangles(6, this.segmentCount);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
  }

  snapshot(): SimulationSnapshot {
    const n = this.count;
    const snapshot: GrowthSnapshot = {
      owner: this,
      count: n,
      xs: this.xs.slice(0, n),
      ys: this.ys.slice(0, n),
      next: this.next.slice(0, n),
      prev: this.prev.slice(0, n),
      dispose: () => undefined,
    };
    return snapshot;
  }

  restore(snapshot: SimulationSnapshot): void {
    const s = snapshot as Partial<GrowthSnapshot>;
    if (s.owner !== this || !s.xs || !s.ys || !s.next || !s.prev || s.count === undefined) return;
    this.ensureCapacity(s.count);
    this.xs.set(s.xs);
    this.ys.set(s.ys);
    this.next.set(s.next);
    this.prev.set(s.prev);
    this.count = s.count;
    this.settled = false;
    this.uploaded = false;
  }

  /** Painting drops new seed rings along the stroke. */
  setPointer(pointer: SimulationPointer | null): void {
    if (!pointer || pointer.mode !== 'paint') {
      this.lastSpawn = null;
      return;
    }
    const [x, y] = pointer.uv;
    const last = this.lastSpawn;
    if (last && Math.hypot(wrap(x - last[0]), wrap(y - last[1])) < 0.05) return;
    this.lastSpawn = [x, y];
    this.addRing(x, y, 0.02, 0.008);
    this.settled = false;
    this.uploaded = false;
  }

  dispose(): void {
    if (this.texture) this.gpu.gl.deleteTexture(this.texture);
    this.texture = null;
  }

  // ---- Nodes --------------------------------------------------------------------------------

  private ensureCapacity(n: number): void {
    if (n <= this.xs.length) return;
    const size = Math.min(NODE_LIMIT, Math.max(n, this.xs.length * 2));
    const grow = <T extends Float64Array | Int32Array>(a: T, make: (n: number) => T): T => {
      const b = make(size);
      b.set(a);
      return b;
    };
    this.xs = grow(this.xs, (k) => new Float64Array(k));
    this.ys = grow(this.ys, (k) => new Float64Array(k));
    this.next = grow(this.next, (k) => new Int32Array(k));
    this.prev = grow(this.prev, (k) => new Int32Array(k));
    this.nx = new Float64Array(size);
    this.ny = new Float64Array(size);
    this.chain = new Int32Array(size);
  }

  private addNode(x: number, y: number): number {
    this.ensureCapacity(this.count + 1);
    const i = this.count++;
    this.xs[i] = x;
    this.ys[i] = y;
    return i;
  }

  /** Links nodes first … count-1 into a ring. */
  private closeRing(first: number): void {
    const last = this.count - 1;
    for (let i = first; i <= last; i++) {
      this.next[i] = i === last ? first : i + 1;
      this.prev[i] = i === first ? last : i - 1;
    }
  }

  private addRing(cx: number, cy: number, radius: number, spacing: number): void {
    const n = Math.max(8, Math.ceil((Math.PI * 2 * radius) / (spacing * 0.6)));
    if (this.count + n > NODE_LIMIT) return;
    const first = this.count;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.addNode(unit(cx + Math.cos(a) * radius), unit(cy + Math.sin(a) * radius));
    }
    this.closeRing(first);
  }

  /** One growth step: forces from a spatial hash, then edge splits (within the node budget). */
  private iterate(params: ParamValues): void {
    const R = getNumber(params, 'radius', 0.012);
    const repulsion = getNumber(params, 'repulsion', 1);
    const cohesion = getNumber(params, 'cohesion', 0.5) * 0.5;
    const maxNodes = Math.min(NODE_LIMIT, getNumber(params, 'maxNodes', 8000));
    const jitter = getNumber(params, 'jitter', 0.2) * R * 0.05;
    const maxEdge2 = (R * 0.6) ** 2;
    const step = R * 0.25;
    const { xs, ys, next, prev, nx, ny, chain } = this;
    const n = this.count;

    // Spatial hash over cells of size ≥ R (neighbours within R are in the 3×3 block).
    const cells = Math.max(3, Math.floor(1 / R));
    if (this.head.length !== cells * cells) this.head = new Int32Array(cells * cells);
    const head = this.head;
    head.fill(-1);
    for (let i = 0; i < n; i++) {
      const c =
        Math.min(cells - 1, (ys[i]! * cells) | 0) * cells +
        Math.min(cells - 1, (xs[i]! * cells) | 0);
      chain[i] = head[c]!;
      head[c] = i;
    }

    const R2 = R * R;
    const invR = 1 / R;
    let moved = 0;
    for (let i = 0; i < n; i++) {
      const x = xs[i]!;
      const y = ys[i]!;
      const cx = Math.min(cells - 1, (x * cells) | 0);
      const cy = Math.min(cells - 1, (y * cells) | 0);
      let fx = 0;
      let fy = 0;
      for (let oy = -1; oy <= 1; oy++) {
        let row = cy + oy;
        if (row < 0) row += cells;
        else if (row >= cells) row -= cells;
        for (let ox = -1; ox <= 1; ox++) {
          let col = cx + ox;
          if (col < 0) col += cells;
          else if (col >= cells) col -= cells;
          for (let j = head[row * cells + col]!; j >= 0; j = chain[j]!) {
            if (j === i) continue;
            let dx = x - xs[j]!;
            let dy = y - ys[j]!;
            if (dx > 0.5) dx -= 1;
            else if (dx < -0.5) dx += 1;
            if (dy > 0.5) dy -= 1;
            else if (dy < -0.5) dy += 1;
            const d2 = dx * dx + dy * dy;
            if (d2 >= R2 || d2 < 1e-14) continue;
            const d = Math.sqrt(d2);
            const f = (1 - d * invR) / d;
            fx += dx * f;
            fy += dy * f;
          }
        }
      }
      // Cohesion: toward the midpoint of the two neighbours along the curve.
      const p = prev[i]!;
      const q = next[i]!;
      const mx = (wrap(xs[p]! - x) + wrap(xs[q]! - x)) * 0.5;
      const my = (wrap(ys[p]! - y) + wrap(ys[q]! - y)) * 0.5;
      let vx = fx * repulsion * step + mx * cohesion + (this.random() - 0.5) * jitter;
      let vy = fy * repulsion * step + my * cohesion + (this.random() - 0.5) * jitter;
      const v2 = vx * vx + vy * vy;
      if (v2 > step * step) {
        const k = step / Math.sqrt(v2);
        vx *= k;
        vy *= k;
      }
      moved += vx * vx + vy * vy;
      nx[i] = unit(x + vx);
      ny[i] = unit(y + vy);
    }
    this.xs = nx;
    this.ys = ny;
    this.nx = xs;
    this.ny = ys;

    // Asleep once the budget is spent and the average move is a tiny fraction of a step.
    if (this.count >= maxNodes && moved / Math.max(n, 1) < (step * 0.04) ** 2) this.settled = true;

    // Splits: stretched edges get a midpoint node, linked in place.
    for (let i = 0; i < n && this.count < maxNodes; i++) {
      const j = this.next[i]!;
      const dx = wrap(this.xs[j]! - this.xs[i]!);
      const dy = wrap(this.ys[j]! - this.ys[i]!);
      if (dx * dx + dy * dy <= maxEdge2) continue;
      const m = this.addNode(unit(this.xs[i]! + dx / 2), unit(this.ys[i]! + dy / 2));
      this.next[i] = m;
      this.prev[m] = i;
      this.next[m] = j;
      this.prev[j] = m;
    }
  }

  // ---- GPU ----------------------------------------------------------------------------------

  private halfWidth(width: number, params: ParamValues): number {
    return Math.max(0.5, (getNumber(params, 'lineWidth', 2) * width) / 1024);
  }

  /**
   * Uploads one texel per drawn segment (start and end, unwrapped). Segments within a line
   * width of an edge get their shifted torus copies too.
   */
  private upload(width: number, height: number, params: ParamValues): void {
    if (this.uploaded) return;
    this.uploaded = true;
    const n = this.count;
    if (n === 0) {
      this.segmentCount = 0;
      return;
    }
    const mx = (this.halfWidth(width, params) + 2) / width;
    const my = (this.halfWidth(width, params) + 2) / height;
    const { xs, ys, next } = this;
    let k = 0;
    const push = (ax: number, ay: number, bx: number, by: number) => {
      if ((k + 1) * 4 > this.segments.length) {
        const bigger = new Float32Array(Math.max(4096, this.segments.length * 2));
        bigger.set(this.segments);
        this.segments = bigger;
      }
      const s = this.segments;
      s[k * 4] = ax;
      s[k * 4 + 1] = ay;
      s[k * 4 + 2] = bx;
      s[k * 4 + 3] = by;
      k++;
    };
    for (let i = 0; i < n; i++) {
      const ax = xs[i]!;
      const ay = ys[i]!;
      const j = next[i]!;
      const bx = ax + wrap(xs[j]! - ax);
      const by = ay + wrap(ys[j]! - ay);
      push(ax, ay, bx, by);
      // Shifted copies where the segment reaches past an edge.
      const sx = Math.min(ax, bx) < mx ? 1 : Math.max(ax, bx) > 1 - mx ? -1 : 0;
      const sy = Math.min(ay, by) < my ? 1 : Math.max(ay, by) > 1 - my ? -1 : 0;
      if (sx) push(ax + sx, ay, bx + sx, by);
      if (sy) push(ax, ay + sy, bx, by + sy);
      if (sx && sy) push(ax + sx, ay + sy, bx + sx, by + sy);
    }
    this.segmentCount = k;
    const rows = Math.ceil(k / TEX_WIDTH);
    if (rows * TEX_WIDTH * 4 > this.segments.length) {
      const bigger = new Float32Array(rows * TEX_WIDTH * 4);
      bigger.set(this.segments);
      this.segments = bigger;
    }
    const data = this.segments.subarray(0, rows * TEX_WIDTH * 4);
    const { gl } = this.gpu;
    activateUploadUnit(gl);
    if (!this.texture) {
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      this.texRows = 0;
    } else gl.bindTexture(gl.TEXTURE_2D, this.texture);
    if (rows > this.texRows) {
      // Grown with headroom so the texture is not reallocated every few splits.
      const alloc = Math.max(rows, Math.ceil(this.texRows * 1.5));
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TEX_WIDTH, alloc, 0, gl.RGBA, gl.FLOAT, null);
      this.texRows = alloc;
    }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TEX_WIDTH, rows, gl.RGBA, gl.FLOAT, data);
  }
}
