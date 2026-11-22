import type { SimulationPointer } from '../engine/generator';
import type { NodeInputDef, NodeOutputDef, NodeValueType } from '../engine/nodes';
import { clamp } from '../util/math';
import { h } from './dom';
import { icon } from './icons';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;
const WHEEL_STEP = 1.15;
/** Node card geometry, in graph (world) units. */
export const NODE_IMAGE = 320;
/** Even frame around the image: same gap on the sides, below the header and at the bottom. */
const GUTTER = 14;
const HEADER = 28;
const PAD = GUTTER;
export const NODE_WIDTH = NODE_IMAGE + 2 * GUTTER;
/** Corner radius and minimum straight run of links (graph units). */
const LINK_RADIUS = 10;
const LINK_STUB = 22;
/** Vertical distance between pins; a side's pins are centered on the image. */
const PIN_STEP = 30;
/** Background dot spacing (graph units); cards snap to it. */
export const GRID = 24;
/** Height of one pin row in a collapsed card. */
const COLLAPSED_ROW = 26;
/** Width of a collapsed card (header buttons and pin names still fit). */
const COLLAPSED_WIDTH = 232;
/** Idle time (ms) after a pan / zoom before the cards are re-rasterized at the new scale. */
const SETTLE_MS = 180;
/** Pin and link colors by value type. */
export const VALUE_COLORS: Readonly<Record<NodeValueType, string>> = {
  gray: '#cfcfcf',
  color: '#f08fd8',
};
const VALUE_LABELS: Readonly<Record<NodeValueType, string>> = {
  gray: 'grayscale',
  color: 'color',
};
/** Inputs reading any image, and outputs whose kind is not known yet. */
const ANY_COLOR = '#e8e8e8';
/** Drag distance (px) before a press on a card becomes a move. */
const DRAG_THRESHOLD = 4;
const SVG_NS = 'http://www.w3.org/2000/svg';

type Rect = readonly [number, number, number, number];

/**
 * SVG path data covering `outer` minus the union of `holes` (rects as x0, y0, x1, y1), as
 * non-overlapping rectangles (safe with any fill rule, overlapping holes included).
 */
export function rectMinusHoles(outer: Rect, holes: readonly Rect[]): string {
  const xs = [...new Set([outer[0], outer[2], ...holes.flatMap((r) => [r[0], r[2]])])]
    .filter((x) => x >= outer[0] && x <= outer[2])
    .sort((a, b) => a - b);
  const ys = [...new Set([outer[1], outer[3], ...holes.flatMap((r) => [r[1], r[3]])])]
    .filter((y) => y >= outer[1] && y <= outer[3])
    .sort((a, b) => a - b);
  const covered = (x: number, y: number) =>
    holes.some((r) => x > r[0] && x < r[2] && y > r[1] && y < r[3]);
  let d = '';
  for (let j = 0; j + 1 < ys.length; j++) {
    const y0 = ys[j]!;
    const y1 = ys[j + 1]!;
    let run: number | null = null;
    for (let i = 0; i + 1 < xs.length; i++) {
      const free = !covered((xs[i]! + xs[i + 1]!) / 2, (y0 + y1) / 2);
      if (free && run === null) run = xs[i]!;
      const last = i + 2 === xs.length;
      if (run !== null && (!free || last)) {
        const x1 = free ? xs[i + 1]! : xs[i]!;
        d += `M${run} ${y0}H${x1}V${y1}H${run}Z`;
        run = null;
      }
    }
  }
  return d;
}

/** SVG path through `pts` (axis-aligned segments) with corners rounded to `radius`. */
export function roundedPolyline(points: readonly (readonly [number, number])[], radius: number) {
  // Drop repeated and collinear points: corners only.
  const pts: (readonly [number, number])[] = [];
  for (const p of points) {
    const last = pts[pts.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 0.01 && Math.abs(last[1] - p[1]) < 0.01) continue;
    const prev = pts[pts.length - 2];
    if (last && prev) {
      const cross = (last[0] - prev[0]) * (p[1] - last[1]) - (last[1] - prev[1]) * (p[0] - last[0]);
      if (Math.abs(cross) < 0.01) pts.pop();
    }
    pts.push(p);
  }
  const first = pts[0];
  if (!first) return '';
  let d = `M${first[0]},${first[1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1]!;
    const [cx, cy] = pts[i]!;
    const [nx, ny] = pts[i + 1]!;
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const sx = cx - ((cx - px) / inLen) * r;
    const sy = cy - ((cy - py) / inLen) * r;
    const ex = cx + ((nx - cx) / outLen) * r;
    const ey = cy + ((ny - cy) / outLen) * r;
    d += ` L${sx},${sy} Q${cx},${cy} ${ex},${ey}`;
  }
  const last = pts[pts.length - 1]!;
  if (pts.length > 1) d += ` L${last[0]},${last[1]}`;
  return d;
}

export interface GraphViewNode {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly x: number;
  readonly y: number;
  readonly postEnabled: boolean;
  /** Frozen nodes keep their current image (time and simulation stopped). */
  readonly frozen: boolean;
  readonly inputs: readonly NodeInputDef[];
  /** Channel outputs; empty = one main output pin. */
  readonly outputs: readonly NodeOutputDef[];
  readonly failed: boolean;
  /** Collapsed cards hide their image (header and pins only). */
  readonly collapsed: boolean;
  /** Detected kind of the main output (null while unknown). */
  readonly outputType: NodeValueType | null;
}

/** Stable identity of a link (one link per target input). */
function linkKey(link: { readonly to: string; readonly input: string }): string {
  return `${link.to}\n${link.input}`;
}

export interface GraphViewLink {
  readonly from: string;
  readonly to: string;
  readonly input: string;
  /** Channel output of `from` (absent = main output). */
  readonly output?: string;
}

export interface ViewportCallbacks {
  /** Painting on the selected node (simulations); null when released. */
  readonly onPointer: (pointer: SimulationPointer | null) => void;
  /** The split handle was dragged to `pos` (0..1 across the texture). */
  readonly onSplit: (pos: number) => void;
  readonly onSelect: (id: string) => void;
  /** The multi-selection changed (always contains the selected node). */
  readonly onSelection: (ids: readonly string[]) => void;
  /** Nodes were dragged to new positions (graph units), in one gesture. */
  readonly onMove: (moves: readonly NodeMove[]) => void;
  readonly onConnect: (from: string, output: string | undefined, to: string, input: string) => void;
  readonly onDisconnect: (to: string, input: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onToggleCollapse: (id: string) => void;
  readonly onTogglePost: (id: string) => void;
  readonly onToggleFreeze: (id: string) => void;
  /**
   * A link was dropped on empty space: from an output (`from`) or from an input (`to`), at
   * `world` graph units / `client` screen pixels (quick-add menu).
   */
  readonly onLinkDrop: (drop: LinkDrop) => void;
}

export interface LinkDrop {
  readonly from?: { readonly node: string; readonly output: string | undefined };
  readonly to?: { readonly node: string; readonly input: string };
  readonly world: readonly [number, number];
  readonly client: readonly [number, number];
}

export interface NodeMove {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/** Where a node image lies on the canvas, in device pixels (top-left origin). */
export interface NodeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Card {
  readonly id: string;
  readonly element: HTMLElement;
  readonly image: HTMLElement;
  readonly title: HTMLElement;
  readonly postBtn: HTMLButtonElement;
  readonly freezeBtn: HTMLButtonElement;
  readonly collapseBtn: HTMLButtonElement;
  readonly inGutter: HTMLElement;
  readonly outGutter: HTMLElement;
  data: GraphViewNode;
  /** Stacking order (higher = in front); the last selected card comes to the front. */
  z: number;
}

/**
 * The viewport is the node graph: every node is a card showing its live image (drawn by the
 * renderer on one canvas behind the cards, at each card's image rect), with input pins on the
 * left edge and the output pin on the right edge, wired by curved links. The selected node is
 * the one edited in the Details panel and painted on (simulations).
 *
 * Navigation: wheel = zoom at cursor; middle-drag or Alt+drag = pan; double-click the
 * background or F = fit all nodes. Selection: click a card; Shift+click adds / removes it;
 * dragging the background draws a selection box. Drag a card (header, or image when it can't
 * be painted) to move it with the rest of the selection. Links are dragged from an output to
 * an input or the other way round.
 */
export class Viewport {
  readonly canvas: HTMLCanvasElement;
  /** Container for the floating viewport toolbar (filled by Toolbar). */
  readonly toolbarSlot: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly world: HTMLElement;
  /** Links live under the canvas (hidden behind node images), with the same transform. */
  private readonly linkWorld: HTMLElement;
  private readonly linkLayer: SVGSVGElement;
  private readonly dragPath: SVGPathElement;
  private readonly errorBox: HTMLPreElement;
  private readonly hint: HTMLElement;
  private readonly splitHandle: HTMLElement;
  private readonly zoomLabel: HTMLButtonElement;
  private readonly brushCursor: HTMLElement;
  private readonly cards = new Map<string, Card>();
  private links: readonly GraphViewLink[] = [];
  private selectedId = '';
  /** Selected nodes (view state only; always contains selectedId). */
  private readonly selection = new Set<string>();
  private readonly marquee: HTMLElement;
  /** Link clicked last (Delete removes it); null when none. */
  private selectedLinkKey: string | null = null;
  private zCounter = 0;
  /** Brush radius in texture uv (null = no brush preview). */
  private brushRadius: number | null = null;
  private viewTiles = 1;
  private paintable = false;
  private zoom = 1;
  private pan: [number, number] = [0, 0];
  /** Pixel size of the selected node's preview (for the 1:1 zoom readout). */
  private renderSize = 512;
  private fitted = false;
  /** Workspace aspect (width / height): node images keep NODE_IMAGE width. */
  private aspect = 1;

  constructor(
    readonly element: HTMLElement,
    private readonly callbacks: ViewportCallbacks,
  ) {
    this.canvas = h('canvas', { class: 'vp-canvas', width: 1, height: 1 });
    this.errorBox = h('pre', { class: 'error-overlay', hidden: true });
    this.hint = h('div', { class: 'vp-hint', hidden: true });
    this.toolbarSlot = h('div', { class: 'vp-toolbar' });
    this.splitHandle = h(
      'div',
      { class: 'split-handle', hidden: true, title: 'Drag to move the split' },
      h('span', { class: 'split-label left' }),
      h('span', { class: 'split-grip' }),
      h('span', { class: 'split-label right' }),
    );
    this.brushCursor = h('div', { class: 'brush-cursor', hidden: true });
    this.marquee = h('div', { class: 'vp-marquee', hidden: true });
    this.linkLayer = document.createElementNS(SVG_NS, 'svg');
    this.linkLayer.classList.add('vp-links');
    this.dragPath = document.createElementNS(SVG_NS, 'path');
    this.dragPath.classList.add('vp-link', 'dragging');
    this.world = h('div', { class: 'vp-world' });
    this.linkWorld = h('div', { class: 'vp-world vp-link-world' });
    this.linkWorld.append(this.linkLayer as unknown as HTMLElement);
    // Stacking: links, then the canvas (node images), then the cards (headers, pins).
    this.stage = h(
      'div',
      { class: 'vp-stage' },
      this.linkWorld,
      this.canvas,
      this.world,
      this.marquee,
    );
    // Never let the browser start a native drag (text of pin labels, images…): it would hijack
    // the pointer and later "drop" the dragged text into another window.
    this.stage.addEventListener('dragstart', (e) => e.preventDefault());

    this.zoomLabel = h('button', {
      class: 'vp-btn vp-zoom-label',
      title: 'Zoom (100% = one texel of the selected node per screen pixel). Click: 1:1',
      onclick: () => this.setPixelZoom(1),
    });
    const zoomBar = h(
      'div',
      { class: 'vp-zoom' },
      h(
        'div',
        { class: 'vp-group' },
        h(
          'button',
          { class: 'vp-btn', title: 'Zoom out (−)', onclick: () => this.zoomBy(1 / 1.5) },
          icon('zoomOut', 14),
        ),
        this.zoomLabel,
        h(
          'button',
          { class: 'vp-btn', title: 'Zoom in (+)', onclick: () => this.zoomBy(1.5) },
          icon('zoomIn', 14),
        ),
        h(
          'button',
          {
            class: 'vp-btn',
            title: 'Fit all nodes (F or double-click the background)',
            onclick: () => this.fit(),
          },
          icon('fit', 14),
        ),
        h(
          'button',
          {
            class: 'vp-btn',
            title: 'Frame the selected node (Shift+F)',
            onclick: () => this.frameSelected(),
          },
          icon('viewport', 14),
        ),
      ),
    );
    element.append(this.stage, this.errorBox, this.toolbarSlot, zoomBar, this.hint);
    this.bindNavigation();
    this.stage.addEventListener('pointermove', (e) => {
      this.lastPointer = [e.clientX, e.clientY];
    });
    this.stage.addEventListener('pointerleave', () => {
      this.lastPointer = null;
    });
    this.bindPainting();
    this.bindSplit();
    new ResizeObserver(() => {
      if (!this.fitted && this.cards.size > 0 && this.stage.clientWidth > 0) this.fit();
      else this.applyTransform();
    }).observe(this.stage);
  }

  // ---- Graph content ------------------------------------------------------------------------

  private get imageHeight(): number {
    return Math.round(NODE_IMAGE / this.aspect);
  }

  private get nodeHeight(): number {
    return HEADER + PAD + this.imageHeight + PAD;
  }

  /** Height of a card's body: its image, or one row per pin when collapsed. */
  private bodyHeight(card: Card): number {
    if (!card.data.collapsed) return this.imageHeight;
    return Math.max(1, card.data.inputs.length, card.data.outputs.length) * COLLAPSED_ROW;
  }

  private cardHeight(card: Card): number {
    return HEADER + PAD + this.bodyHeight(card) + PAD;
  }

  private cardWidth(card: Card): number {
    return card.data.collapsed ? COLLAPSED_WIDTH : NODE_WIDTH;
  }

  /** Nearest grid position: cards snap to the background dots. */
  static snap(v: number): number {
    return Math.round(v / GRID) * GRID;
  }

  /** Where a new node goes so that its input (or output) pin lands on `world`. */
  nodeOriginForPin(world: readonly [number, number], side: 'input' | 'output'): [number, number] {
    const x = side === 'input' ? world[0] - GUTTER / 2 : world[0] - NODE_WIDTH + GUTTER / 2;
    return [Viewport.snap(x), Viewport.snap(world[1] - HEADER - PAD - this.imageHeight / 2)];
  }

  /** Workspace aspect ratio (width / height); resizes every card's image. */
  setAspect(aspect: number): void {
    if (aspect === this.aspect) return;
    this.aspect = aspect;
    for (const card of this.cards.values()) this.sizeImage(card);
    this.renderLinks();
    this.updateOcclusion();
  }

  private sizeImage(card: Card): void {
    card.element.style.width = `${this.cardWidth(card)}px`;
    card.image.style.width = `${this.cardWidth(card) - 2 * GUTTER}px`;
    card.image.style.height = `${this.bodyHeight(card)}px`;
    this.layoutPins(card);
  }

  /** Center of pin `index` of `count` on a side, from the top of the card body. */
  private pinOffset(card: Card, index: number, count: number): number {
    if (card.data.collapsed) return (index + 0.5) * COLLAPSED_ROW;
    return this.imageHeight / 2 + (index - (count - 1) / 2) * PIN_STEP;
  }

  private layoutPins(card: Card): void {
    for (const gutter of [card.inGutter, card.outGutter]) {
      const pins = [...gutter.querySelectorAll<HTMLElement>('.pin')];
      pins.forEach((pin, i) => (pin.style.top = `${this.pinOffset(card, i, pins.length)}px`));
    }
  }

  /** Reconciles the cards and links with the graph. */
  setGraph(
    nodes: readonly GraphViewNode[],
    links: readonly GraphViewLink[],
    selectedId: string,
  ): void {
    const ids = new Set(nodes.map((n) => n.id));
    for (const [id, card] of this.cards) {
      if (ids.has(id)) continue;
      card.element.remove();
      this.cards.delete(id);
    }
    for (const node of nodes) {
      const card = this.cards.get(node.id) ?? this.createCard(node);
      this.updateCard(card, node);
    }
    this.links = links;
    if (selectedId !== this.selectedId) {
      this.selectedId = selectedId;
      this.splitHandle.hidden = true;
    }
    // Keep the multi-selection consistent with the graph and the selected node.
    let changed = false;
    for (const id of this.selection) {
      if (!ids.has(id)) {
        this.selection.delete(id);
        changed = true;
      }
    }
    if (!this.selection.has(selectedId)) {
      this.selection.clear();
      this.selection.add(selectedId);
      changed = true;
    }
    if (changed) this.callbacks.onSelection([...this.selection]);
    for (const card of this.cards.values()) {
      const selected = card.id === selectedId;
      card.element.classList.toggle('selected', selected);
      card.element.classList.toggle('multi', !selected && this.selection.has(card.id));
      card.image.classList.toggle('canvas-frame', selected);
      card.image.classList.toggle('preview-canvas', selected);
      if (selected && this.splitHandle.parentElement !== card.image)
        card.image.append(this.splitHandle, this.brushCursor);
    }
    if (this.selectedLinkKey && !this.links.some((l) => linkKey(l) === this.selectedLinkKey))
      this.selectedLinkKey = null;
    this.renderLinks();
    this.updateOcclusion();
    if (!this.fitted && this.stage.clientWidth > 0) this.fit();
  }

  /** Ids of the selected nodes (the selected one included). */
  selectedIds(): string[] {
    return [...this.selection];
  }

  /** Selects node `id` alone (it becomes the edited node). */
  selectOnly(id: string): void {
    if (this.cards.has(id)) this.select([id], id);
  }

  /** Selects several nodes (`primary` is the edited one), e.g. after a paste. */
  selectMany(ids: readonly string[], primary: string): void {
    if (this.cards.has(primary)) this.select(ids, primary);
  }

  /** Last pointer position over the graph (world units), or null when it is elsewhere. */
  pointerWorld(): [number, number] | null {
    return this.lastPointer ? this.toWorld(this.lastPointer[0], this.lastPointer[1]) : null;
  }

  private lastPointer: [number, number] | null = null;

  /** Replaces the multi-selection; `primary` becomes the selected (edited) node. */
  private select(ids: Iterable<string>, primary: string): void {
    const list = [...ids]; // `ids` may be the selection itself
    this.selection.clear();
    for (const id of list) if (this.cards.has(id)) this.selection.add(id);
    this.selection.add(primary);
    for (const card of this.cards.values()) {
      card.element.classList.toggle('multi', card.id !== primary && this.selection.has(card.id));
    }
    this.selectLink(null);
    this.raise(primary);
    this.callbacks.onSelection([...this.selection]);
    if (primary !== this.selectedId) this.callbacks.onSelect(primary);
  }

  /** Image rect of every node card on the canvas (device pixels), for the renderer. */
  nodeRects(): Map<string, NodeRect> {
    const stage = this.stage.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const out = new Map<string, NodeRect>();
    // Back to front: a card in front draws over the ones behind it.
    for (const card of [...this.cards.values()].sort((a, b) => a.z - b.z)) {
      if (card.data.collapsed) continue;
      const r = card.image.getBoundingClientRect();
      out.set(card.id, {
        x: (r.left - stage.left) * dpr,
        y: (r.top - stage.top) * dpr,
        width: r.width * dpr,
        height: r.height * dpr,
      });
    }
    return out;
  }

  /** Canvas size in device pixels (the stage size). */
  canvasSize(): { width: number; height: number } {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    return {
      width: Math.max(1, Math.round(this.stage.clientWidth * dpr)),
      height: Math.max(1, Math.round(this.stage.clientHeight * dpr)),
    };
  }

  /** Graph position for a new node: right of `nearId`'s card, or the view center. */
  placementNear(nearId: string | null): [number, number] {
    const near = nearId ? this.cards.get(nearId) : undefined;
    let x: number;
    let y: number;
    if (near) {
      x = near.data.x + NODE_WIDTH + 80;
      y = near.data.y;
    } else {
      const c = this.toWorld(
        this.stage.getBoundingClientRect().left + this.stage.clientWidth / 2,
        this.stage.getBoundingClientRect().top + this.stage.clientHeight / 2,
      );
      x = c[0] - NODE_WIDTH / 2;
      y = c[1] - this.nodeHeight / 2;
    }
    // Step down until the spot is free.
    const overlaps = (px: number, py: number) =>
      [...this.cards.values()].some(
        (c) => Math.abs(c.data.x - px) < NODE_WIDTH && Math.abs(c.data.y - py) < this.nodeHeight,
      );
    x = Viewport.snap(x);
    y = Viewport.snap(y);
    for (let i = 0; i < 50 && overlaps(x, y); i++) y = Viewport.snap(y + this.nodeHeight + 40);
    return [x, y];
  }

  private createCard(node: GraphViewNode): Card {
    const title = h('span', { class: 'node-title' });
    const postBtn = h(
      'button',
      {
        class: 'node-btn node-post',
        title: 'Post Process on / bypassed (raw generator output)',
        'aria-label': 'Toggle Post Process',
        onclick: (e: Event) => {
          e.stopPropagation();
          this.callbacks.onTogglePost(node.id);
        },
      },
      icon('fx', 13),
    );
    const freezeBtn = h(
      'button',
      {
        class: 'node-btn node-freeze',
        title: 'Freeze frame: keep the current image while other nodes keep playing',
        'aria-label': 'Freeze frame',
        onclick: (e: Event) => {
          e.stopPropagation();
          this.callbacks.onToggleFreeze(node.id);
        },
      },
      icon('snowflake', 13),
    );
    const close = h(
      'button',
      {
        class: 'node-btn node-close',
        title: 'Delete node (Del)',
        'aria-label': 'Delete node',
        onclick: (e: Event) => {
          e.stopPropagation();
          this.callbacks.onDelete(node.id);
        },
      },
      icon('close', 12),
    );
    const collapseBtn = h(
      'button',
      {
        class: 'node-btn node-collapse',
        'aria-label': 'Collapse node',
        onclick: (e: Event) => {
          e.stopPropagation();
          this.callbacks.onToggleCollapse(node.id);
        },
      },
      icon('expand', 16),
    );
    const head = h('div', { class: 'node-head' }, collapseBtn, title, freezeBtn, postBtn, close);
    const image = h('div', { class: 'node-image' });
    const inGutter = h('div', { class: 'node-gutter in' });
    const outGutter = h('div', { class: 'node-gutter out' });
    const element = h(
      'div',
      { class: 'node', 'data-id': node.id },
      head,
      h('div', { class: 'node-body' }, inGutter, image, outGutter),
      h('div', { class: 'node-foot' }),
    );
    element.style.width = `${NODE_WIDTH}px`;
    const card: Card = {
      id: node.id,
      element,
      image,
      title,
      postBtn,
      freezeBtn,
      collapseBtn,
      inGutter,
      outGutter,
      data: node,
      z: ++this.zCounter,
    };
    element.style.zIndex = String(card.z);
    this.sizeImage(card);
    this.bindCard(card, head);
    this.buildOutputs(card, node.outputs);
    this.world.append(element);
    this.cards.set(node.id, card);
    return card;
  }

  private updateCard(card: Card, node: GraphViewNode): void {
    const prev = card.data;
    card.data = node;
    card.element.style.transform = `translate(${node.x}px, ${node.y}px)`;
    card.element.dataset.category = node.category;
    card.element.classList.toggle('failed', node.failed);
    card.element.classList.toggle('post-off', !node.postEnabled);
    card.title.textContent = node.title;
    card.element.classList.toggle('frozen', node.frozen);
    card.postBtn.classList.toggle('on', node.postEnabled);
    card.postBtn.setAttribute('aria-pressed', String(node.postEnabled));
    card.freezeBtn.classList.toggle('on', node.frozen);
    card.freezeBtn.setAttribute('aria-pressed', String(node.frozen));
    card.element.classList.toggle('collapsed', node.collapsed);
    card.collapseBtn.setAttribute('aria-expanded', String(!node.collapsed));
    card.collapseBtn.title = node.collapsed
      ? 'Expand the node'
      : 'Collapse the node (hides its image)';
    const sameOutputs =
      prev.outputs.length === node.outputs.length &&
      prev.outputs.every((d, i) => d.key === node.outputs[i]?.key);
    if (!sameOutputs) this.buildOutputs(card, node.outputs);
    if (node.outputs.length === 0) {
      // The main output pin shows the detected kind of value.
      const pin = card.outGutter.querySelector<HTMLElement>('.pin.out');
      pin?.style.setProperty(
        '--pin-color',
        node.outputType ? VALUE_COLORS[node.outputType] : ANY_COLOR,
      );
      if (pin)
        pin.title = `Output${node.outputType ? ` (${VALUE_LABELS[node.outputType]})` : ''}: drag onto another node’s input`;
    }
    if (prev !== node || card.inGutter.childElementCount !== node.inputs.length) {
      const sameInputs =
        prev.inputs.length === node.inputs.length &&
        prev.inputs.every((d, i) => d.key === node.inputs[i]?.key) &&
        card.inGutter.childElementCount === node.inputs.length;
      if (!sameInputs) {
        card.inGutter.replaceChildren(
          ...node.inputs.map((input) => {
            const pin = h(
              'div',
              {
                class: 'pin in',
                'data-input': input.key,
                title: `${input.label}${input.value ? ` (${VALUE_LABELS[input.value]})` : ''}: ${input.description}`,
              },
              h('span', { class: 'pin-dot' }),
              h('span', { class: 'pin-label', text: input.label }),
            );
            pin.style.setProperty(
              '--pin-color',
              input.value ? VALUE_COLORS[input.value] : ANY_COLOR,
            );
            this.bindInputPin(card, pin, input.key);
            return pin;
          }),
        );
      }
    }
    if (prev.collapsed !== node.collapsed || card.image.style.height === '') this.sizeImage(card);
    else this.layoutPins(card);
  }

  /** Output pins: one main output, or one per channel output. */
  private buildOutputs(card: Card, outputs: readonly NodeOutputDef[]): void {
    const pin = (output: NodeOutputDef | null) => {
      const el = h(
        'div',
        {
          class: 'pin out',
          'data-output': output?.key ?? '',
          title: output
            ? `${output.label}: ${output.description} Drag onto another node’s input.`
            : 'Output: drag onto another node’s input',
        },
        h('span', { class: 'pin-dot' }),
        ...(output ? [h('span', { class: 'pin-label', text: output.label })] : []),
      );
      if (output) el.style.setProperty('--pin-color', output.color);
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        this.dragLink(card.id, output?.key, e, el);
      });
      return el;
    };
    card.outGutter.replaceChildren(...(outputs.length > 0 ? outputs.map(pin) : [pin(null)]));
    this.layoutPins(card);
  }

  // ---- Links --------------------------------------------------------------------------------

  private outPinPos(id: string, output?: string): [number, number] | null {
    const c = this.cards.get(id);
    if (!c) return null;
    const outputs = c.data.outputs;
    const i = output ? outputs.findIndex((d) => d.key === output) : 0;
    if (i < 0) return null;
    const y = c.data.y + HEADER + PAD + this.pinOffset(c, i, Math.max(1, outputs.length));
    return [c.data.x + this.cardWidth(c) - GUTTER / 2, y];
  }

  private inPinPos(id: string, input: string): [number, number] | null {
    const c = this.cards.get(id);
    const inputs = c?.data.inputs ?? [];
    const i = inputs.findIndex((d) => d.key === input);
    return c && i >= 0
      ? [c.data.x + GUTTER / 2, c.data.y + HEADER + PAD + this.pinOffset(c, i, inputs.length)]
      : null;
  }

  /**
   * Shader Graph-like link: horizontal out of the output, vertical, horizontal into the input,
   * with rounded corners. Backward links (input left of the output) go around through the
   * middle height.
   */
  private static curve(a: readonly [number, number], b: readonly [number, number]): string {
    const pts: [number, number][] =
      b[0] - a[0] >= 2 * LINK_STUB
        ? [
            [a[0], a[1]],
            [(a[0] + b[0]) / 2, a[1]],
            [(a[0] + b[0]) / 2, b[1]],
            [b[0], b[1]],
          ]
        : [
            [a[0], a[1]],
            [a[0] + LINK_STUB, a[1]],
            [a[0] + LINK_STUB, (a[1] + b[1]) / 2],
            [b[0] - LINK_STUB, (a[1] + b[1]) / 2],
            [b[0] - LINK_STUB, b[1]],
            [b[0], b[1]],
          ];
    return roundedPolyline(pts, LINK_RADIUS);
  }

  /**
   * Colors of a link at its output and input ends. The start is the value leaving the output
   * (detected grayscale / color, or the channel color of a channel output); the end is the
   * value the input reads, so feeding color into a grayscale input (or the reverse) shows as a
   * gradient. Inputs reading any image keep the start color.
   */
  private linkColors(link: GraphViewLink): [string, string] {
    const from = this.cards.get(link.from)?.data;
    const channel = link.output ? from?.outputs.find((d) => d.key === link.output) : undefined;
    const sourceType: NodeValueType | null = channel ? 'gray' : (from?.outputType ?? null);
    const start = channel?.color ?? (sourceType ? VALUE_COLORS[sourceType] : ANY_COLOR);
    const wanted = this.cards.get(link.to)?.data.inputs.find((d) => d.key === link.input)?.value;
    const end = wanted && sourceType && wanted !== sourceType ? VALUE_COLORS[wanted] : start;
    return [start, end];
  }

  private renderLinks(): void {
    const paths: SVGElement[] = [];
    const defs = document.createElementNS(SVG_NS, 'defs');
    const startColors = new Map<string, string>();
    this.links.forEach((link, i) => {
      const a = this.outPinPos(link.from, link.output);
      const b = this.inPinPos(link.to, link.input);
      if (!a || !b) return;
      const [start, end] = this.linkColors(link);
      startColors.set(linkKey(link), start);
      const d = Viewport.curve(a, b);
      let stroke = start;
      if (end !== start) {
        const grad = document.createElementNS(SVG_NS, 'linearGradient');
        grad.id = `vp-link-gradient-${i}`;
        grad.setAttribute('gradientUnits', 'userSpaceOnUse');
        grad.setAttribute('x1', String(a[0]));
        grad.setAttribute('y1', String(a[1]));
        grad.setAttribute('x2', String(b[0]));
        grad.setAttribute('y2', String(b[1]));
        for (const [offset, color] of [
          ['0.2', start],
          ['0.8', end],
        ] as const) {
          const stop = document.createElementNS(SVG_NS, 'stop');
          stop.setAttribute('offset', offset);
          stop.setAttribute('stop-color', color);
          grad.append(stop);
        }
        defs.append(grad);
        stroke = `url(#${grad.id})`;
      }
      // Wide invisible stroke: easy to click (selects the link; Delete removes it).
      const hit = document.createElementNS(SVG_NS, 'path');
      hit.classList.add('vp-link-hit');
      hit.setAttribute('d', d);
      hit.dataset.key = linkKey(link);
      const path = document.createElementNS(SVG_NS, 'path');
      path.classList.add('vp-link');
      path.classList.toggle('selected', linkKey(link) === this.selectedLinkKey);
      path.setAttribute('d', d);
      path.style.setProperty('--link-color', stroke);
      paths.push(hit, path);
    });
    for (const card of this.cards.values()) {
      for (const pin of card.inGutter.querySelectorAll<HTMLElement>('.pin.in')) {
        const key = linkKey({ to: card.id, input: pin.dataset.input ?? '' });
        const linked = startColors.has(key);
        pin.classList.toggle('linked', linked);
        // Inputs reading any image take the color of what feeds them.
        const def = card.data.inputs.find((d) => d.key === pin.dataset.input);
        if (def && !def.value)
          pin.style.setProperty('--pin-color', startColors.get(key) ?? ANY_COLOR);
      }
      for (const pin of card.outGutter.querySelectorAll<HTMLElement>('.pin.out')) {
        const key = pin.dataset.output || undefined;
        pin.classList.toggle(
          'linked',
          this.links.some((l) => l.from === card.id && l.output === key),
        );
      }
    }
    this.linkLayer.replaceChildren(defs, ...paths, this.dragPath);
    this.dragPath.setAttribute('d', '');
  }

  /** Selects a link (highlighted; Delete removes it), or clears the link selection. */
  private selectLink(key: string | null): void {
    if (key === this.selectedLinkKey) return;
    this.selectedLinkKey = key;
    for (const path of this.linkLayer.querySelectorAll<SVGPathElement>('.vp-link-hit')) {
      const visible = path.nextElementSibling;
      visible?.classList.toggle('selected', path.dataset.key === key);
    }
  }

  /** The link selected by a click, if any (to delete it). */
  selectedLink(): { readonly to: string; readonly input: string } | null {
    const key = this.selectedLinkKey;
    return this.links.find((l) => linkKey(l) === key) ?? null;
  }

  /** Brings card `id` in front of the others. */
  private raise(id: string): void {
    const card = this.cards.get(id);
    if (!card || card.z === this.zCounter) return;
    card.z = ++this.zCounter;
    card.element.style.zIndex = String(card.z);
    this.updateOcclusion();
  }

  /**
   * Node images are drawn on one canvas behind every card, so a card's image shows through
   * "holes" in the cards above it. Each card is clipped where the image of a card in front of
   * it lies: overlapping cards look stacked (the front one entirely visible).
   */
  private updateOcclusion(): void {
    const cards = [...this.cards.values()].sort((a, b) => a.z - b.z);
    // Room for the shadow, outline and pin labels around the card.
    const mx = 160;
    const my = 40;
    cards.forEach((c, i) => {
      const w = this.cardWidth(c);
      const hgt = this.cardHeight(c);
      const outer: Rect = [-mx, -my, w + mx, hgt + my];
      const holes: Rect[] = [];
      for (const d of cards.slice(i + 1)) {
        if (d.data.collapsed) continue;
        const x0 = d.data.x + GUTTER - c.data.x;
        const y0 = d.data.y + HEADER + PAD - c.data.y;
        const hole: Rect = [
          Math.max(x0, outer[0]),
          Math.max(y0, outer[1]),
          Math.min(x0 + NODE_IMAGE, outer[2]),
          Math.min(y0 + this.imageHeight, outer[3]),
        ];
        if (hole[2] > hole[0] && hole[3] > hole[1]) holes.push(hole);
      }
      c.element.style.clipPath = holes.length ? `path('${rectMinusHoles(outer, holes)}')` : '';
    });
  }

  /** Drags a new link backwards from an input; dropping on an output pin connects it. */
  private dragLinkFromInput(to: string, input: string, e: PointerEvent, capture: HTMLElement) {
    const end = this.inPinPos(to, input);
    if (!end) return;
    capture.setPointerCapture(e.pointerId);
    this.stage.classList.add('linking');
    const clearHover = () => {
      for (const el of this.stage.querySelectorAll('.pin.out.hover')) el.classList.remove('hover');
    };
    const move = (ev: PointerEvent) => {
      const p = this.toWorld(ev.clientX, ev.clientY);
      this.dragPath.setAttribute('d', Viewport.curve(p, end));
      clearHover();
      this.outPinAt(ev.clientX, ev.clientY)?.pin.classList.add('hover');
    };
    const up = (ev: PointerEvent) => {
      capture.removeEventListener('pointermove', move);
      capture.removeEventListener('pointerup', up);
      capture.removeEventListener('pointercancel', up);
      this.stage.classList.remove('linking');
      this.dragPath.setAttribute('d', '');
      clearHover();
      const source = ev.type === 'pointerup' ? this.outPinAt(ev.clientX, ev.clientY) : null;
      if (source && source.node !== to)
        this.callbacks.onConnect(source.node, source.output, to, input);
      else if (ev.type === 'pointerup' && this.isEmptyAt(ev.clientX, ev.clientY))
        this.callbacks.onLinkDrop({
          to: { node: to, input },
          world: this.toWorld(ev.clientX, ev.clientY),
          client: [ev.clientX, ev.clientY],
        });
    };
    capture.addEventListener('pointermove', move);
    capture.addEventListener('pointerup', up);
    capture.addEventListener('pointercancel', up);
    move(e);
  }

  /** Output pin under the cursor (with some tolerance). */
  private outPinAt(
    x: number,
    y: number,
  ): { pin: HTMLElement; node: string; output: string | undefined } | null {
    let best: { pin: HTMLElement; node: string; output: string | undefined } | null = null;
    let bestDist = 18;
    for (const card of this.cards.values()) {
      for (const pin of card.outGutter.querySelectorAll<HTMLElement>('.pin.out')) {
        const r = pin.querySelector('.pin-dot')!.getBoundingClientRect();
        const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (d < bestDist) {
          bestDist = d;
          best = { pin, node: card.id, output: pin.dataset.output || undefined };
        }
      }
    }
    return best;
  }

  /** Drags a new link from `from`'s output; dropping on an input pin connects it. */
  private dragLink(
    from: string,
    output: string | undefined,
    e: PointerEvent,
    capture: HTMLElement,
  ): void {
    const start = this.outPinPos(from, output);
    if (!start) return;
    capture.setPointerCapture(e.pointerId);
    this.stage.classList.add('linking');
    const move = (ev: PointerEvent) => {
      const p = this.toWorld(ev.clientX, ev.clientY);
      this.dragPath.setAttribute('d', Viewport.curve(start, p));
      for (const el of this.stage.querySelectorAll('.pin.in.hover')) el.classList.remove('hover');
      this.pinAt(ev.clientX, ev.clientY)?.pin.classList.add('hover');
    };
    const up = (ev: PointerEvent) => {
      capture.removeEventListener('pointermove', move);
      capture.removeEventListener('pointerup', up);
      capture.removeEventListener('pointercancel', up);
      this.stage.classList.remove('linking');
      this.dragPath.setAttribute('d', '');
      for (const el of this.stage.querySelectorAll('.pin.in.hover')) el.classList.remove('hover');
      const target = ev.type === 'pointerup' ? this.pinAt(ev.clientX, ev.clientY) : null;
      if (target && target.node !== from)
        this.callbacks.onConnect(from, output, target.node, target.input);
      else if (!target && ev.type === 'pointerup' && this.isEmptyAt(ev.clientX, ev.clientY))
        this.callbacks.onLinkDrop({
          from: { node: from, output },
          world: this.toWorld(ev.clientX, ev.clientY),
          client: [ev.clientX, ev.clientY],
        });
    };
    capture.addEventListener('pointermove', move);
    capture.addEventListener('pointerup', up);
    capture.addEventListener('pointercancel', up);
    move(e);
  }

  /** True when (x, y) is over the graph background (not a card). */
  private isEmptyAt(x: number, y: number): boolean {
    const r = this.stage.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
    return ![...this.cards.values()].some((c) => {
      const b = c.element.getBoundingClientRect();
      return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
    });
  }

  /** Input pin under the cursor (with some tolerance). */
  private pinAt(x: number, y: number): { pin: HTMLElement; node: string; input: string } | null {
    let best: { pin: HTMLElement; node: string; input: string } | null = null;
    let bestDist = 18;
    for (const card of this.cards.values()) {
      for (const pin of card.inGutter.querySelectorAll<HTMLElement>('.pin.in')) {
        const r = pin.querySelector('.pin-dot')!.getBoundingClientRect();
        const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (d < bestDist) {
          bestDist = d;
          best = { pin, node: card.id, input: pin.dataset.input ?? '' };
        }
      }
    }
    return best;
  }

  // ---- Card interactions --------------------------------------------------------------------

  private bindCard(card: Card, head: HTMLElement): void {
    /**
     * Moves the whole selection with the pointer. Positions follow the pointer in world space,
     * so zooming or panning during the drag keeps the nodes under the cursor.
     */
    const startMove = (e: PointerEvent, from: HTMLElement) => {
      e.preventDefault();
      const start = [e.clientX, e.clientY];
      const grab = this.toWorld(e.clientX, e.clientY);
      const group = [...this.selection]
        .map((id) => this.cards.get(id))
        .filter((c): c is Card => c !== undefined)
        .map((c) => ({ card: c, origin: [c.data.x, c.data.y] as const }));
      let moved = false;
      const lead = [card.data.x, card.data.y] as const;
      from.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - start[0]!, ev.clientY - start[1]!) < DRAG_THRESHOLD)
          return;
        moved = true;
        const p = this.toWorld(ev.clientX, ev.clientY);
        let dx = p[0] - grab[0];
        let dy = p[1] - grab[1];
        // The grabbed card snaps to the grid (Ctrl: free move); the others keep their offsets.
        if (!ev.ctrlKey) {
          dx = Viewport.snap(lead[0] + dx) - lead[0];
          dy = Viewport.snap(lead[1] + dy) - lead[1];
        }
        for (const { card: c, origin } of group) {
          const x = Math.round(origin[0] + dx);
          const y = Math.round(origin[1] + dy);
          c.data = { ...c.data, x, y };
          c.element.style.transform = `translate(${x}px, ${y}px)`;
          c.element.classList.add('moving');
        }
        this.renderLinks();
        this.updateOcclusion();
      };
      const up = () => {
        from.removeEventListener('pointermove', move);
        from.removeEventListener('pointerup', up);
        from.removeEventListener('pointercancel', up);
        for (const { card: c } of group) c.element.classList.remove('moving');
        if (moved) {
          this.callbacks.onMove(
            group.map(({ card: c }) => ({ id: c.id, x: c.data.x, y: c.data.y })),
          );
        } else if (this.selection.size > 1) {
          // A plain click inside a multi-selection selects just that node.
          this.select([card.id], card.id);
        }
      };
      from.addEventListener('pointermove', move);
      from.addEventListener('pointerup', up);
      from.addEventListener('pointercancel', up);
    };

    // Capture phase: the selection is updated before a drag starts from the header or image.
    card.element.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0 || e.altKey) return;
        this.selectLink(null);
        if ((e.target as HTMLElement).closest('.pin')) return;
        if (e.shiftKey) {
          if (this.selection.has(card.id) && this.selection.size > 1) {
            const rest = [...this.selection].filter((id) => id !== card.id);
            this.select(
              rest,
              card.id === this.selectedId ? rest[rest.length - 1]! : this.selectedId,
            );
          } else {
            this.select([...this.selection, card.id], card.id);
          }
        } else if (!this.selection.has(card.id)) {
          this.select([card.id], card.id);
        } else if (card.id !== this.selectedId) {
          this.select(this.selection, card.id);
        }
      },
      { capture: true },
    );
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.altKey || e.shiftKey) return;
      if ((e.target as HTMLElement).closest('button')) return;
      startMove(e, head);
    });
    card.image.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.altKey || e.shiftKey) return;
      const paintHere = this.paintable && card.id === this.selectedId && this.selection.size === 1;
      if (!paintHere) startMove(e, card.image);
    });
  }

  /**
   * Pressing a linked input pin detaches its link and lets the user re-plug it; pressing a
   * free one drags a new link toward an output.
   */
  private bindInputPin(card: Card, pin: HTMLElement, input: string): void {
    pin.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const link = this.links.find((l) => l.to === card.id && l.input === input);
      if (!link) {
        this.dragLinkFromInput(card.id, input, e, pin);
        return;
      }
      this.callbacks.onDisconnect(card.id, input);
      this.dragLink(link.from, link.output, e, pin);
    });
  }

  /** Left-drag on the background: selection box (Shift adds to the selection). */
  private startMarquee(e: PointerEvent): void {
    const stage = this.stage.getBoundingClientRect();
    const start = [e.clientX, e.clientY] as const;
    const additive = e.shiftKey;
    const before = [...this.selection];
    let dragged = false;
    this.stage.setPointerCapture(e.pointerId);
    const box = (ev: PointerEvent) => ({
      left: Math.min(start[0], ev.clientX),
      top: Math.min(start[1], ev.clientY),
      right: Math.max(start[0], ev.clientX),
      bottom: Math.max(start[1], ev.clientY),
    });
    const hits = (b: ReturnType<typeof box>) =>
      [...this.cards.values()]
        .filter((c) => {
          const r = c.element.getBoundingClientRect();
          return r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom;
        })
        .map((c) => c.id);
    const move = (ev: PointerEvent) => {
      if (!dragged && Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) < DRAG_THRESHOLD)
        return;
      dragged = true;
      const b = box(ev);
      Object.assign(this.marquee.style, {
        left: `${b.left - stage.left}px`,
        top: `${b.top - stage.top}px`,
        width: `${b.right - b.left}px`,
        height: `${b.bottom - b.top}px`,
      });
      this.marquee.hidden = false;
      const inside = new Set(hits(b));
      for (const card of this.cards.values())
        card.element.classList.toggle('marquee-hit', inside.has(card.id));
    };
    const up = (ev: PointerEvent) => {
      this.stage.removeEventListener('pointermove', move);
      this.stage.removeEventListener('pointerup', up);
      this.stage.removeEventListener('pointercancel', up);
      this.marquee.hidden = true;
      for (const card of this.cards.values()) card.element.classList.remove('marquee-hit');
      if (!dragged) {
        // Click on the background: back to the selected node alone.
        if (!additive && this.selection.size > 1) this.select([this.selectedId], this.selectedId);
        return;
      }
      const picked = hits(box(ev));
      const ids = additive ? [...new Set([...before, ...picked])] : picked;
      if (ids.length === 0) {
        this.select([this.selectedId], this.selectedId);
        return;
      }
      const primary = ids.includes(this.selectedId) ? this.selectedId : ids[ids.length - 1]!;
      this.select(ids, primary);
    };
    this.stage.addEventListener('pointermove', move);
    this.stage.addEventListener('pointerup', up);
    this.stage.addEventListener('pointercancel', up);
  }

  /**
   * Card position (snapped graph units) for a node dropped from the generator browser at a
   * screen point, or null when the point is outside the viewport.
   */
  dropPosition(clientX: number, clientY: number): [number, number] | null {
    const r = this.stage.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    const [x, y] = this.toWorld(clientX, clientY);
    return [Viewport.snap(x - NODE_WIDTH / 2), Viewport.snap(y - HEADER / 2)];
  }

  /** Highlights the viewport while a generator is dragged over it. */
  setDropHighlight(on: boolean): void {
    this.stage.classList.toggle('drop-target', on);
  }

  // ---- Overlays -----------------------------------------------------------------------------

  /** Short visual feedback when the selected node's content changes. */
  pulse(): void {
    const card = this.cards.get(this.selectedId);
    if (!card) return;
    card.element.classList.remove('pulse');
    void card.element.offsetWidth; // restart the animation
    card.element.classList.add('pulse');
  }

  setViewTiles(n: number): void {
    this.viewTiles = n;
  }

  get tiles(): number {
    return this.viewTiles;
  }

  /** Whether left-drag on the selected node paints (simulations) or moves it. */
  setPaintable(paintable: boolean): void {
    this.paintable = paintable;
    this.stage.classList.toggle('paintable', paintable);
  }

  setError(message: string | null): void {
    this.errorBox.hidden = message === null;
    this.errorBox.textContent = message ?? '';
  }

  setHint(text: string | null): void {
    this.hint.hidden = text === null;
    this.hint.textContent = text ?? '';
  }

  /** Pixel size of the selected node's preview (zoom readout, 1:1). */
  setRenderSize(size: number): void {
    if (size === this.renderSize) return;
    this.renderSize = size;
    this.refreshZoomLabel();
  }

  /** Circle showing the brush footprint under the pointer (radius in texture uv). */
  setBrushRadius(radius: number | null): void {
    this.brushRadius = this.paintable ? radius : null;
    if (this.brushRadius === null) this.brushCursor.hidden = true;
  }

  /** Shows the split handle at `pos` (0..1), or hides it (null). Hidden when tiled. */
  setSplit(pos: number | null, labels?: readonly [string, string]): void {
    const visible = pos !== null && this.viewTiles === 1;
    this.splitHandle.hidden = !visible;
    if (!visible) return;
    this.splitHandle.style.left = `${pos * 100}%`;
    const [left, right] = this.splitHandle.querySelectorAll('.split-label');
    if (left) left.textContent = labels?.[0] ?? '';
    if (right) right.textContent = labels?.[1] ?? '';
  }

  /** True when the selected image is magnified enough to show texels as squares. */
  get magnified(): boolean {
    return this.pixelZoomPercent > 140;
  }

  // ---- Zoom & pan ---------------------------------------------------------------------------

  private toWorld(clientX: number, clientY: number): [number, number] {
    const r = this.stage.getBoundingClientRect();
    return [
      (clientX - r.left - this.pan[0]) / this.zoom,
      (clientY - r.top - this.pan[1]) / this.zoom,
    ];
  }

  /** Fits a world-space box into the stage. */
  private frameBox(x0: number, y0: number, x1: number, y1: number, maxZoom: number): void {
    const w = this.stage.clientWidth;
    const hgt = this.stage.clientHeight;
    if (w <= 0 || hgt <= 0) return;
    const margin = 48;
    this.zoom = clamp(
      Math.min((w - 2 * margin) / (x1 - x0), (hgt - 2 * margin) / (y1 - y0)),
      MIN_ZOOM,
      maxZoom,
    );
    this.pan = [
      (w - (x1 - x0) * this.zoom) / 2 - x0 * this.zoom,
      (hgt - (y1 - y0) * this.zoom) / 2 - y0 * this.zoom,
    ];
    this.fitted = true;
    this.applyTransform();
  }

  /** Fits every node in view. */
  fit(): void {
    const cards = [...this.cards.values()];
    if (cards.length === 0) return;
    this.frameBox(
      Math.min(...cards.map((c) => c.data.x)),
      Math.min(...cards.map((c) => c.data.y)),
      Math.max(...cards.map((c) => c.data.x + this.cardWidth(c))),
      Math.max(...cards.map((c) => c.data.y + this.cardHeight(c))),
      cards.length === 1 ? 4 : 2,
    );
  }

  frameSelected(): void {
    const c = this.cards.get(this.selectedId);
    if (c)
      this.frameBox(
        c.data.x,
        c.data.y,
        c.data.x + this.cardWidth(c),
        c.data.y + this.cardHeight(c),
        8,
      );
  }

  zoomBy(factor: number, clientX?: number, clientY?: number): void {
    const next = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const rect = this.stage.getBoundingClientRect();
    // Keep the point under the cursor (default: stage center) fixed.
    const cx = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const cy = (clientY ?? rect.top + rect.height / 2) - rect.top;
    const k = next / this.zoom;
    this.pan = [cx - (cx - this.pan[0]) * k, cy - (cy - this.pan[1]) * k];
    this.zoom = next;
    this.applyTransform();
  }

  /** Zoom so one texel of the selected node covers `ratio` CSS pixels (1 = 1:1). */
  setPixelZoom(ratio: number): void {
    const card = this.cards.get(this.selectedId);
    if (!card) return;
    const target = (ratio * this.renderSize) / (this.viewTiles * NODE_IMAGE);
    const r = card.image.getBoundingClientRect();
    this.zoomBy(target / this.zoom, r.left + r.width / 2, r.top + r.height / 2);
  }

  /** Current zoom in percent of one texel of the selected node per CSS pixel. */
  get pixelZoomPercent(): number {
    return (NODE_IMAGE * this.zoom * 100 * this.viewTiles) / Math.max(1, this.renderSize);
  }

  private refreshZoomLabel(): void {
    const pct = this.pixelZoomPercent;
    this.zoomLabel.textContent = `${pct >= 100 ? Math.round(pct) : pct.toFixed(pct < 10 ? 1 : 0)}%`;
  }

  private applyTransform(): void {
    const transform = `translate(${this.pan[0]}px, ${this.pan[1]}px) scale(${this.zoom})`;
    this.world.style.transform = transform;
    this.linkWorld.style.transform = transform;
    this.stage.style.setProperty('--zoom', String(this.zoom));
    this.applyBackground();
    this.refreshZoomLabel();
    // While panning / zooming the world is one GPU layer (fast, but rasterized once: text
    // and icons blur when scaled). Once the view settles, the layer is dropped so the cards
    // are drawn sharp again at the current zoom.
    this.stage.classList.add('moving');
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.stage.classList.remove('moving'), SETTLE_MS);
  }

  private settleTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * World-space dot grid: it pans and zooms with the graph. Its spacing doubles / halves to
   * stay between 12 and 24 screen pixels, the finer level fading in, so it looks the same at
   * every zoom (exactly the original 24px grid at 100%).
   */
  private applyBackground(): void {
    const base = GRID * this.zoom;
    const s = base * 2 ** Math.ceil(Math.log2(12 / base));
    const t = clamp((s - 12) / 12, 0, 1);
    const [px, py] = this.pan;
    const st = this.stage.style;
    st.setProperty('--dot-fine', (0.07 * t).toFixed(4));
    // Coarse dots are also fine dots: together they keep the original intensity.
    st.setProperty('--dot-coarse', (0.07 * (1 - t)).toFixed(4));
    st.backgroundSize = `${s}px ${s}px, ${2 * s}px ${2 * s}px`;
    st.backgroundPosition = `${px - s / 2}px ${py - s / 2}px, ${px - s}px ${py - s}px`;
  }

  private bindNavigation(): void {
    this.stage.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const steps = clamp(-e.deltaY / 100, -4, 4);
        this.zoomBy(WHEEL_STEP ** steps, e.clientX, e.clientY);
      },
      { passive: false },
    );
    this.stage.addEventListener('dblclick', (e) => {
      if (!(e.target as HTMLElement).closest('.node')) this.fit();
    });
    // Capture phase: middle / Alt drags pan even over cards; left-drag on the background
    // draws a selection box.
    this.stage.addEventListener(
      'pointerdown',
      (e) => {
        // Clicking the graph takes keyboard focus back from the Details panel (Del, F…).
        const active = document.activeElement;
        if (active instanceof HTMLElement && !this.stage.contains(active)) active.blur();
        const target = e.target as Element;
        const onCard = target.closest('.node') !== null;
        if (e.button === 0 && !e.altKey && target.classList.contains('vp-link-hit')) {
          e.preventDefault();
          this.selectLink((target as SVGElement).dataset.key ?? null);
          return;
        }
        if (e.button === 0 && !e.altKey && !onCard) {
          this.selectLink(null);
          e.preventDefault();
          this.startMarquee(e);
          return;
        }
        const pan = e.button === 1 || (e.button === 0 && e.altKey);
        if (!pan) return;
        e.preventDefault();
        e.stopPropagation();
        this.stage.setPointerCapture(e.pointerId);
        this.stage.classList.add('panning');
        let last = [e.clientX, e.clientY];
        const move = (ev: PointerEvent) => {
          this.pan = [this.pan[0] + ev.clientX - last[0]!, this.pan[1] + ev.clientY - last[1]!];
          last = [ev.clientX, ev.clientY];
          this.applyTransform();
        };
        const up = () => {
          this.stage.classList.remove('panning');
          this.stage.removeEventListener('pointermove', move);
          this.stage.removeEventListener('pointerup', up);
          this.stage.removeEventListener('pointercancel', up);
        };
        this.stage.addEventListener('pointermove', move);
        this.stage.addEventListener('pointerup', up);
        this.stage.addEventListener('pointercancel', up);
      },
      { capture: true },
    );
    window.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'f') this.fit();
      else if (e.key === 'F') this.frameSelected();
      else if (e.key === '+' || e.key === '=') this.zoomBy(1.5);
      else if (e.key === '-') this.zoomBy(1 / 1.5);
      else if (e.key === '1') this.setPixelZoom(1);
    });
  }

  private bindSplit(): void {
    this.splitHandle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.splitHandle.setPointerCapture(e.pointerId);
      this.splitHandle.classList.add('dragging');
      const move = (ev: PointerEvent) => {
        const image = this.splitHandle.parentElement;
        if (!image) return;
        const rect = image.getBoundingClientRect();
        const pos = clamp((ev.clientX - rect.left) / rect.width, 0.02, 0.98);
        this.splitHandle.style.left = `${pos * 100}%`;
        this.callbacks.onSplit(pos);
      };
      const up = () => {
        this.splitHandle.classList.remove('dragging');
        this.splitHandle.removeEventListener('pointermove', move);
        this.splitHandle.removeEventListener('pointerup', up);
      };
      this.splitHandle.addEventListener('pointermove', move);
      this.splitHandle.addEventListener('pointerup', up);
    });
  }

  private selectedImage(): HTMLElement | null {
    return this.cards.get(this.selectedId)?.image ?? null;
  }

  private moveBrushCursor(e: PointerEvent, image: HTMLElement): void {
    const r = this.brushRadius;
    if (r === null) return;
    const rect = image.getBoundingClientRect();
    const size = NODE_IMAGE; // the cursor lives in (unscaled) card space
    const x = ((e.clientX - rect.left) / rect.width) * size;
    const y = ((e.clientY - rect.top) / rect.height) * size;
    const d = (2 * r * size) / this.viewTiles;
    this.brushCursor.hidden = false;
    this.brushCursor.style.width = `${d}px`;
    this.brushCursor.style.height = `${d}px`;
    this.brushCursor.style.transform = `translate(${x - d / 2}px, ${y - d / 2}px)`;
    this.brushCursor.classList.toggle('erase', e.shiftKey || (e.buttons & 2) !== 0);
  }

  /** Painting on the selected node's image (delegated: cards come and go). */
  private bindPainting(): void {
    // Last position (texture uv) and smoothed stroke velocity, for direction-aware brushes.
    let last: [number, number] | null = null;
    let velocity: [number, number] = [0, 0];
    let painting: HTMLElement | null = null;
    const toPointer = (e: PointerEvent, image: HTMLElement): SimulationPointer => {
      // getBoundingClientRect includes the zoom/pan transform.
      const rect = image.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      const n = this.viewTiles;
      const wrap = (v: number) => (((v * n) % 1) + 1) % 1;
      const uv: [number, number] = [wrap(x), wrap(y)];
      if (last) {
        const d = (a: number, b: number) => a - b - Math.round(a - b); // wrapped delta
        velocity = [
          velocity[0] * 0.5 + d(uv[0], last[0]) * 0.5,
          velocity[1] * 0.5 + d(uv[1], last[1]) * 0.5,
        ];
      }
      last = uv;
      const erase = e.shiftKey || (e.buttons & 2) !== 0;
      return { uv, mode: erase ? 'erase' : 'paint', velocity };
    };
    const onSelectedImage = (e: Event) => {
      const image = this.selectedImage();
      return image && (e.target as Node | null) && image.contains(e.target as Node) ? image : null;
    };
    this.world.addEventListener('contextmenu', (e) => {
      if (onSelectedImage(e) && this.paintable) e.preventDefault();
    });
    this.world.addEventListener('pointerdown', (e) => {
      const image = onSelectedImage(e);
      if (!image || !this.paintable || e.button === 1 || e.altKey) return;
      if ((e.target as HTMLElement).closest('.split-handle')) return;
      image.setPointerCapture(e.pointerId);
      painting = image;
      last = null;
      velocity = [0, 0];
      this.callbacks.onPointer(toPointer(e, image));
    });
    this.world.addEventListener('pointermove', (e) => {
      const image = painting ?? onSelectedImage(e);
      if (!image) {
        this.brushCursor.hidden = true;
        return;
      }
      this.moveBrushCursor(e, image);
      if (painting && e.buttons !== 0) this.callbacks.onPointer(toPointer(e, painting));
    });
    const release = () => {
      if (!painting) return;
      painting = null;
      this.callbacks.onPointer(null);
    };
    this.world.addEventListener('pointerup', release);
    this.world.addEventListener('pointercancel', release);
  }
}
