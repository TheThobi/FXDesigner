import type {
  GeneratorDefinition,
  SimulationGenerator,
  SimulationPointer,
} from '../engine/generator';
import { ShaderCompileError } from '../engine/gl/ShaderProgram';
import { POST_PARAMS } from '../engine/post/schema';
import { Renderer, type FrameRequest } from '../engine/Renderer';
import { DEFAULT_GENERATOR_ID, GENERATORS, getGenerator } from '../generators/registry';
import type { ParamValue, ParamValues, Preset } from '../params/types';
import { defaultValues, sanitizeValues } from '../params/values';
import { h, isEditingText } from '../ui/dom';
import { askFlipbookOptions } from '../ui/FlipbookDialog';
import { GeneratorList } from '../ui/GeneratorList';
import { ParamPanel } from '../ui/ParamPanel';
import { toast } from '../ui/toast';
import { Toolbar } from '../ui/Toolbar';
import { Viewport } from '../ui/Viewport';
import { debounce } from '../util/debounce';
import { downloadBlob, pickFile } from '../util/download';
import { MAX_SEED, randomSeed } from '../util/random';
import { clamp } from '../util/math';
import {
  applyDocument,
  documentFromState,
  DocumentError,
  parseDocument,
  serializeDocument,
  type TextureDocument,
} from './document';
import { captureToDataUrl, renderFlipbook, renderPng } from './exporter';
import { History } from './history';
import { clearHash, loadSession, readHashDocument, saveSession, shareUrl } from './persistence';
import {
  DEFAULT_RESOLUTION,
  MAX_PREVIEW_SIZE,
  paramsOf,
  postDefaults,
  postOf,
  RESOLUTIONS,
  type EditorState,
} from './state';

const THUMBNAIL_SIZE = 64;

function errorMessage(e: unknown): string {
  if (e instanceof ShaderCompileError) return e.annotated();
  return e instanceof Error ? e.message : String(e);
}

/**
 * Application controller: owns the editor state and wires UI events, the renderer and the
 * animation loop together. UI components never mutate state directly; they call back here.
 */
export class App {
  private state: EditorState;
  private readonly history = new History<EditorState>();
  private playing = true;
  private viewTiles = 1;
  private time = 0;
  private dirty = true;
  private pointerActive = false;
  private readonly failed = new Set<string>();

  private readonly renderer: Renderer;
  private readonly viewport: Viewport;
  private readonly toolbar: Toolbar;
  private readonly generatorList: GeneratorList;
  private readonly paramPanel: ParamPanel;
  private readonly postPanel: ParamPanel;
  private readonly inspectorTitle: HTMLElement;
  private readonly inspectorDescription: HTMLElement;

  private lastFrame = 0;
  private fpsFrames = 0;
  private fpsElapsed = 0;
  private fps = 0;

  private readonly autosave = debounce(() => saveSession(this.document()), 400);

  constructor(root: HTMLElement) {
    const toolbarEl = h('header', { class: 'toolbar' });
    const sidebarEl = h('aside', { class: 'sidebar' });
    const viewportEl = h('main', { class: 'viewport' });
    this.inspectorTitle = h('h2');
    this.inspectorDescription = h('p', { class: 'description' });
    const paramsEl = h('div');
    const postEl = h('div');
    const inspectorEl = h(
      'aside',
      { class: 'inspector' },
      h('div', { class: 'inspector-header' }, this.inspectorTitle, this.inspectorDescription),
      paramsEl,
      h('h2', { class: 'section-title', text: 'Output' }),
      postEl,
    );
    root.append(h('div', { class: 'app' }, toolbarEl, sidebarEl, viewportEl, inspectorEl));

    this.viewport = new Viewport(viewportEl, (p) => this.onPointer(p));
    this.renderer = new Renderer(this.viewport.canvas);
    this.generatorList = new GeneratorList(sidebarEl, (id) => this.selectGenerator(id));
    this.paramPanel = new ParamPanel(paramsEl);
    this.postPanel = new ParamPanel(postEl);
    this.toolbar = new Toolbar(toolbarEl, RESOLUTIONS, {
      togglePlay: () => this.togglePlay(),
      restart: () => this.restart(),
      setSeed: (seed) => this.setSeed(seed),
      randomSeed: () => this.setSeed(randomSeed()),
      setResolution: (r) => this.commit({ ...this.state, resolution: r }),
      setViewTiles: (n) => this.setViewTiles(n),
      undo: () => this.undo(),
      redo: () => this.redo(),
      exportPng: () => void this.exportPng(),
      exportFlipbook: () => void this.exportFlipbook(),
      share: () => this.share(),
      saveFile: () => this.saveFile(),
      loadFile: () => void this.loadFile(),
    });

    this.state = this.initialState();
    this.activateGenerator();
    this.bindGlobalEvents();
    requestAnimationFrame(this.frame);
    setTimeout(() => this.renderThumbnails(), 200);
  }

  // ---- State -------------------------------------------------------------------------------

  private get generator(): GeneratorDefinition {
    return getGenerator(this.state.generatorId) ?? GENERATORS[0]!;
  }

  private get params(): ParamValues {
    return paramsOf(this.state, this.generator);
  }

  private get post(): ParamValues {
    return postOf(this.state, this.generator);
  }

  private document(): TextureDocument {
    return documentFromState(this.state, getGenerator);
  }

  private initialState(): EditorState {
    const empty: EditorState = {
      generatorId: DEFAULT_GENERATOR_ID,
      params: {},
      post: {},
      resolution: DEFAULT_RESOLUTION,
      seed: 1,
    };
    try {
      const fromHash = readHashDocument();
      if (fromHash) {
        clearHash();
        const doc = parseDocument(fromHash, getGenerator);
        toast('Loaded shared texture');
        return applyDocument(empty, doc);
      }
    } catch (e) {
      clearHash();
      toast(`Invalid share link: ${errorMessage(e)}`, 'error');
    }
    try {
      const session = loadSession();
      if (session) return applyDocument(empty, parseDocument(session, getGenerator));
    } catch {
      // Stale or incompatible autosave: start fresh.
    }
    return empty;
  }

  /** Single entry point for state changes (undo recording, UI sync, autosave). */
  private commit(next: EditorState, opts: { record?: boolean } = {}): void {
    if (opts.record !== false) this.history.record(this.state);
    const prev = this.state;
    this.state = next;
    if (prev.generatorId !== next.generatorId) this.activateGenerator();
    this.dirty = true;
    this.updateToolbar();
    this.autosave();
  }

  private withParams(values: ParamValues): EditorState {
    return { ...this.state, params: { ...this.state.params, [this.generator.id]: values } };
  }

  private withPost(values: ParamValues): EditorState {
    return { ...this.state, post: { ...this.state.post, [this.generator.id]: values } };
  }

  // ---- Generator & parameters ---------------------------------------------------------------

  private selectGenerator(id: string): void {
    if (id === this.state.generatorId || !getGenerator(id)) return;
    this.commit({ ...this.state, generatorId: id });
  }

  /** Rebuilds generator-dependent UI and GPU state after the generator changed. */
  private activateGenerator(): void {
    const def = this.generator;
    this.generatorList.setActive(def.id);
    this.inspectorTitle.textContent = def.name;
    this.inspectorDescription.textContent = def.description;
    this.renderPanels();
    this.viewport.setError(null);
    if (def.kind === 'simulation') {
      this.resetSimulation();
      this.viewport.setHint('Left-drag: paint · Right/Shift-drag: erase');
    } else {
      this.renderer.releaseSimulation();
      this.viewport.setHint(null);
    }
    this.updateToolbar();
    this.dirty = true;
  }

  private renderPanels(): void {
    const def = this.generator;
    this.paramPanel.render({
      defs: def.params,
      values: this.params,
      presets: def.presets,
      onChange: (key, value) => this.setParam(key, value),
      onPreset: (preset) => this.applyPreset(preset),
      onReset: () => this.replaceParams(defaultValues(def.params)),
    });
    this.postPanel.render({
      defs: POST_PARAMS,
      values: this.post,
      onChange: (key, value) => this.commit(this.withPost({ ...this.post, [key]: value })),
      onReset: () => {
        const values = postDefaults(def);
        this.commit(this.withPost(values));
        this.postPanel.setValues(values);
      },
    });
  }

  private setParam(key: string, value: ParamValue): void {
    const before = this.params;
    this.commit(this.withParams({ ...before, [key]: value }));
    this.maybeResetSimulation(before, this.params);
  }

  private replaceParams(values: ParamValues): void {
    const before = this.params;
    this.commit(this.withParams(values));
    this.paramPanel.setValues(values);
    this.maybeResetSimulation(before, values);
  }

  private applyPreset(preset: Preset): void {
    const def = this.generator;
    this.replaceParams(
      sanitizeValues(def.params, { ...this.params, ...preset.values }, this.params),
    );
  }

  // ---- Simulation ---------------------------------------------------------------------------

  private get simulationDef(): SimulationGenerator | null {
    const def = this.generator;
    return def.kind === 'simulation' ? def : null;
  }

  private resetSimulation(): void {
    const def = this.simulationDef;
    if (!def) return;
    try {
      this.renderer.simulationFor(def).sim.reset(this.params, this.state.seed);
      this.dirty = true;
    } catch (e) {
      this.showRenderError(def.id, e);
    }
  }

  private maybeResetSimulation(before: ParamValues, after: ParamValues): void {
    const def = this.simulationDef;
    if (!def) return;
    const changed = def.params.some(
      (p) => p.resetOnChange && JSON.stringify(before[p.key]) !== JSON.stringify(after[p.key]),
    );
    if (changed) this.resetSimulation();
  }

  private onPointer(pointer: SimulationPointer | null): void {
    const def = this.simulationDef;
    if (!def) return;
    this.pointerActive = pointer !== null;
    this.renderer.simulationFor(def).sim.setPointer(pointer);
  }

  // ---- Toolbar actions ----------------------------------------------------------------------

  private togglePlay(): void {
    this.playing = !this.playing;
    this.updateToolbar();
  }

  private restart(): void {
    this.time = 0;
    this.resetSimulation();
    this.dirty = true;
  }

  private setSeed(seed: number): void {
    this.commit({ ...this.state, seed: clamp(Math.round(seed), 0, MAX_SEED) });
    this.resetSimulation();
  }

  private setViewTiles(n: number): void {
    this.viewTiles = n;
    this.viewport.setViewTiles(n);
    this.updateToolbar();
    this.dirty = true;
  }

  private restoreSnapshot(snapshot: EditorState): void {
    const prevGenerator = this.state.generatorId;
    const before = this.params;
    this.commit(snapshot, { record: false });
    if (prevGenerator === snapshot.generatorId) {
      this.paramPanel.setValues(this.params);
      this.postPanel.setValues(this.post);
      this.maybeResetSimulation(before, this.params);
    }
  }

  private undo(): void {
    const s = this.history.undo(this.state);
    if (s) this.restoreSnapshot(s);
  }

  private redo(): void {
    const s = this.history.redo(this.state);
    if (s) this.restoreSnapshot(s);
  }

  private updateToolbar(): void {
    this.toolbar.update({
      playing: this.playing,
      animated: this.generator.animated,
      seed: this.state.seed,
      resolution: this.state.resolution,
      viewTiles: this.viewTiles,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    });
  }

  // ---- Import / export ----------------------------------------------------------------------

  private frameRequest(): FrameRequest {
    return {
      generator: this.generator,
      params: this.params,
      post: this.post,
      time: this.time,
      seed: this.state.seed,
    };
  }

  private fileBase(): string {
    return `${this.generator.id}-s${this.state.seed}`;
  }

  private async exportPng(): Promise<void> {
    const size = this.state.resolution;
    try {
      const blob = await renderPng(this.renderer, this.frameRequest(), size);
      downloadBlob(blob, `${this.fileBase()}-${size}.png`);
      toast(`Exported ${size}×${size} PNG`);
    } catch (e) {
      toast(`Export failed: ${errorMessage(e)}`, 'error');
    }
  }

  private async exportFlipbook(): Promise<void> {
    const def = this.generator;
    const opts = await askFlipbookOptions(
      def.kind === 'simulation',
      this.renderer.gpu.caps.maxTextureSize,
    );
    if (!opts) return;
    const count = opts.columns * opts.rows;
    const base = this.frameRequest();
    const startTime = this.time;
    try {
      const blob = await renderFlipbook(this.renderer, opts, (i) => {
        if (def.kind === 'simulation') {
          const { sim } = this.renderer.simulationFor(def);
          if (i > 0) for (let k = 0; k < opts.stepsBetweenFrames; k++) sim.step(base.params);
          return base;
        }
        return { ...base, time: startTime + (i / count) * opts.duration };
      });
      downloadBlob(blob, `${this.fileBase()}-flipbook-${opts.columns}x${opts.rows}.png`);
      toast(`Exported ${count}-frame flipbook`);
    } catch (e) {
      toast(`Export failed: ${errorMessage(e)}`, 'error');
    }
    this.dirty = true;
  }

  private share(): void {
    const url = shareUrl(this.document());
    // The async clipboard API only exists in secure contexts (HTTPS / localhost).
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(
        () => toast('Share link copied to clipboard'),
        () => window.prompt('Copy this link:', url),
      );
    } else {
      window.prompt('Copy this link:', url);
    }
  }

  private saveFile(): void {
    const blob = new Blob([serializeDocument(this.document())], { type: 'application/json' });
    downloadBlob(blob, `${this.fileBase()}.ptm.json`);
  }

  private async loadFile(): Promise<void> {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const doc = parseDocument(JSON.parse(await file.text()) as unknown, getGenerator);
      const sameGenerator = doc.generator === this.state.generatorId;
      this.commit(applyDocument(this.state, doc));
      if (sameGenerator) {
        this.paramPanel.setValues(this.params);
        this.postPanel.setValues(this.post);
      }
      this.resetSimulation();
      toast(`Loaded ${file.name}`);
    } catch (e) {
      toast(
        e instanceof DocumentError || e instanceof SyntaxError
          ? `Cannot open file: ${e.message}`
          : errorMessage(e),
        'error',
      );
    }
  }

  // ---- Rendering loop -----------------------------------------------------------------------

  private readonly frame = (now: number): void => {
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    const def = this.generator;

    if (!this.failed.has(def.id)) {
      if (def.kind === 'simulation') {
        if (this.playing || this.pointerActive) this.stepSimulation(def);
      } else if (this.playing && def.animated) {
        this.time += dt;
        this.dirty = true;
      }
      if (this.dirty) this.draw();
    }

    this.updateFps(dt);
    requestAnimationFrame(this.frame);
  };

  private stepSimulation(def: SimulationGenerator): void {
    try {
      this.renderer.simulationFor(def).sim.step(this.params);
      this.dirty = true;
    } catch (e) {
      this.showRenderError(def.id, e);
    }
  }

  private draw(): void {
    const def = this.generator;
    try {
      this.renderer.present(this.frameRequest(), {
        size: Math.min(this.state.resolution, MAX_PREVIEW_SIZE),
        viewTiles: this.viewTiles,
      });
      this.dirty = false;
    } catch (e) {
      this.showRenderError(def.id, e);
    }
  }

  private showRenderError(id: string, e: unknown): void {
    this.failed.add(id);
    console.error(e);
    this.viewport.setError(errorMessage(e));
  }

  private updateFps(dt: number): void {
    this.fpsFrames++;
    this.fpsElapsed += dt;
    if (this.fpsElapsed < 0.5) return;
    this.fps = Math.round(this.fpsFrames / this.fpsElapsed);
    this.fpsFrames = 0;
    this.fpsElapsed = 0;
    const { caps } = this.renderer.gpu;
    const preview = Math.min(this.state.resolution, MAX_PREVIEW_SIZE);
    this.viewport.setStatus(
      `${this.fps} fps · preview ${preview}px · export ${this.state.resolution}px · ` +
        `${caps.floatTargets ? 'float32' : caps.halfFloatTargets ? 'float16' : '8-bit'} targets · ${caps.renderer}`,
    );
  }

  /** Renders generator thumbnails one by one in the background. */
  private renderThumbnails(): void {
    const queue = GENERATORS.filter((g) => g.kind === 'shader');
    const capture = this.renderer.createCapture(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    const next = () => {
      const def = queue.shift();
      if (!def) {
        capture.dispose();
        this.dirty = true;
        return;
      }
      try {
        const req = {
          generator: def,
          params: defaultValues(def.params),
          post: postDefaults(def),
          time: 1.3,
          seed: 7,
        };
        this.generatorList.setThumbnail(def.id, captureToDataUrl(capture, req));
      } catch (e) {
        console.warn(`Thumbnail failed for ${def.id}`, e);
      }
      setTimeout(next, 16);
    };
    next();
  }

  // ---- Global events ------------------------------------------------------------------------

  private bindGlobalEvents(): void {
    window.addEventListener('keydown', (e) => {
      if (isEditingText()) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.code === 'Space' && !mod) {
        e.preventDefault();
        this.togglePlay();
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
      }
    });
    window.addEventListener('beforeunload', () => this.autosave.flush());

    const canvas = this.viewport.canvas;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.autosave.flush();
      this.viewport.setError('GPU context lost — reloading when it is restored…');
    });
    canvas.addEventListener('webglcontextrestored', () => window.location.reload());
  }
}
