import {
  CATEGORY_LABELS,
  type GeneratorDefinition,
  type SimulationGenerator,
  type SimulationPointer,
  type SimulationSnapshot,
} from '../engine/generator';
import { ShaderCompileError } from '../engine/gl/ShaderProgram';
import { upgradeLegacyPost } from '../engine/post/legacy';
import {
  DEFAULT_RAMP,
  OUTPUT_PARAMS,
  POST_MODULES,
  POST_PARAMS,
  POST_PROCESS_PARAMS,
  RAMP_OVERRIDE_PARAMS,
  POST_PRESETS,
  SHARED_RAMP_PARAM,
  TIME_PARAMS,
} from '../engine/post/schema';
import type { GradientValue } from '../params/gradient';
import { Renderer, type Capture, type FrameRequest } from '../engine/Renderer';
import { DEFAULT_GENERATOR_ID, GENERATORS, getGenerator } from '../generators/registry';
import type { ParamDef, ParamValue, ParamValues, Preset } from '../params/types';
import { defaultValues, getNumber, sanitizeValues } from '../params/values';
import { h, isEditingText } from '../ui/dom';
import { icon } from '../ui/icons';
import { addPanelClose, dockPanel, tabbedPanel } from '../ui/Panel';
import { createSplitter } from '../ui/Splitter';
import { askFlipbookOptions } from '../ui/FlipbookDialog';
import { GeneratorList } from '../ui/GeneratorList';
import { Layout } from '../ui/Layout';
import { Timeline, TIMELINE_FPS, TIMELINE_SPEEDS } from '../ui/Timeline';
import { ParamPanel } from '../ui/ParamPanel';
import { toast } from '../ui/toast';
import { Toolbar } from '../ui/Toolbar';
import { Viewport } from '../ui/Viewport';
import { debounce } from '../util/debounce';
import { downloadBlob, pickFile } from '../util/download';
import { MAX_SEED, randomSeed } from '../util/random';
import { clamp } from '../util/math';
import { readStorage, writeStorage } from '../util/storage';
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
import { ThumbnailCache } from './thumbnails';
import { clearHash, loadSession, readHashDocument, saveSession, shareUrl } from './persistence';
import {
  DEFAULT_RESOLUTION,
  GLOBAL_PARAMS,
  MAX_PREVIEW_SIZE,
  paramsOf,
  defaultSharedPost,
  postDefaults,
  postOf,
  SCOPED_POST_PARAMS,
  withPostScope,
  withPostValues,
  type PostScope,
  type EditorState,
} from './state';

const THUMBNAIL_SIZE = 64;
/** Displayed frames a simulation runs before its browser thumbnail is captured. */
const SIM_THUMBNAIL_FRAME = 240;
/** Adaptive preview: frame interval (ms) above which edits render at half size… */
const ADAPTIVE_SLOW_MS = 40;
/** …until no change happened for this long (ms). */
const ADAPTIVE_IDLE_MS = 250;
/** Filmstrip / keyframe image size (px). */
const FILM_SIZE = 48;
/** Simulation keyframes kept for the timeline (older ones are thinned out). */
const MAX_KEYFRAMES = 16;
/** Displayed frames between two simulation keyframes, initially (doubles when thinned). */
const KEYFRAME_INTERVAL = 30;
const PLAYBACK_KEY = 'ptm.ui.playback';

interface Keyframe {
  readonly frame: number;
  readonly snapshot: SimulationSnapshot;
  readonly url: string;
}

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
  /** Seconds, always within [0, loop duration]. */
  private time = 0;
  private speed = 1;
  private loopPlayback = true;
  /** Playback suspended while the timeline is scrubbed. */
  private scrubbing = false;
  /** Fractional simulation steps owed (playback speed ≠ 1). */
  private simAccum = 0;
  private keyframes: Keyframe[] = [];
  private keyInterval = KEYFRAME_INTERVAL;
  private dirty = true;
  private pointerActive = false;
  private readonly failed = new Set<string>();

  private readonly renderer: Renderer;
  private readonly viewport: Viewport;
  private readonly toolbar: Toolbar;
  private readonly generatorList: GeneratorList;
  private readonly paramPanel: ParamPanel;
  private readonly postPanel: ParamPanel;
  private readonly colorPanel: ParamPanel;
  private readonly overridePanel: ParamPanel;
  private readonly outputPanel: ParamPanel;
  private readonly animationPanel: ParamPanel;
  private readonly generalPanel: ParamPanel;
  private readonly timeline: Timeline;
  private readonly scopeSwitch: HTMLElement;
  private readonly layout: Layout;
  private readonly inspectorTitle: HTMLElement;
  private readonly inspectorDescription: HTMLElement;
  private readonly inspectorBadge: HTMLElement;
  private readonly statusLeft: HTMLElement;
  private readonly statusRight: HTMLElement;
  private readonly thumbnails = new ThumbnailCache();
  /** Displayed frames since the live simulation was (re)started, for its thumbnail. */
  private simFrames = 0;

  private lastFrame = 0;
  /** Time of the last state change, to detect interactive editing (adaptive preview). */
  private lastChange = 0;
  /** Smoothed frame interval (ms). */
  private frameMs = 16;
  private degraded = false;
  private fpsFrames = 0;
  private fpsElapsed = 0;
  private fps = 0;

  private readonly autosave = debounce(() => saveSession(this.document()), 400);

  constructor(root: HTMLElement) {
    const toolbarEl = h('header', { class: 'toolbar' });
    const appEl = h('div', { class: 'app' });
    this.layout = new Layout(appEl);
    const browser = dockPanel('browser', 'Generators', 'texture', 'aside', () =>
      this.layout.set('browser', false),
    );
    const viewport = dockPanel('viewport', 'Viewport', 'viewport', 'main');
    const details = tabbedPanel('details', [
      { id: 'generator', title: 'Generator', icon: 'details' },
      { id: 'post', title: 'Post Process', icon: 'texture' },
      { id: 'output', title: 'Output', icon: 'download' },
    ]);
    addPanelClose(details.panel, 'Hide the details panel', () => this.layout.set('details', false));

    this.inspectorTitle = h('h2');
    this.inspectorBadge = h('span', { class: 'badge' });
    this.inspectorDescription = h('p', { class: 'description' });
    const detailsSearch = h('input', {
      type: 'search',
      class: 'search',
      placeholder: 'Search settings',
      'aria-label': 'Search settings',
    });
    detailsSearch.addEventListener('input', () => {
      for (const panel of this.panels()) panel.filter(detailsSearch.value);
    });
    details.header.append(h('div', { class: 'search-box' }, icon('search', 14), detailsSearch));

    const paramsEl = h('div');
    const postEl = h('div');
    const colorEl = h('div');
    const overrideEl = h('div');
    const generalEl = h('div');
    const outputEl = h('div');
    const animationEl = h('div');
    details.pages.generator!.append(
      h(
        'div',
        { class: 'inspector-header' },
        h('div', { class: 'inspector-title' }, this.inspectorTitle, this.inspectorBadge),
        this.inspectorDescription,
      ),
      paramsEl,
      overrideEl,
    );
    this.scopeSwitch = h(
      'div',
      { class: 'scope-switch', role: 'group', 'aria-label': 'Post Process scope' },
      h('span', { class: 'scope-label', text: 'Look applies to' }),
      h('button', {
        'data-scope': 'global',
        text: 'All generators',
        title: 'Global: one look shared by every generator, kept when switching',
        onclick: () => this.setPostScope('global'),
      }),
      h('button', {
        'data-scope': 'local',
        text: 'This generator',
        title: 'Local: each generator keeps its own look',
        onclick: () => this.setPostScope('local'),
      }),
    );
    details.pages.post!.append(
      h('p', {
        class: 'page-intro',
        text: 'Look development applied on top of any generator, in pipeline order.',
      }),
      this.scopeSwitch,
      colorEl,
      postEl,
    );
    details.pages.output!.append(
      h('p', { class: 'page-intro', text: 'Settings shared by all generators, and export maps.' }),
      generalEl,
      animationEl,
      outputEl,
    );

    this.statusLeft = h('span');
    this.statusRight = h('span', { class: 'status-right' });
    const statusBar = h('footer', { class: 'statusbar' }, this.statusLeft, this.statusRight);

    const dock = h('div', { class: 'dock' });
    dock.append(
      browser.panel,
      createSplitter(dock, {
        cssVar: '--left-w',
        side: 'left',
        min: 200,
        max: 560,
        defaultWidth: 300,
        storageKey: 'ptm.ui.left',
      }),
      viewport.panel,
      createSplitter(dock, {
        cssVar: '--right-w',
        side: 'right',
        min: 280,
        max: 640,
        defaultWidth: 380,
        storageKey: 'ptm.ui.right',
      }),
      details.panel,
    );
    appEl.append(toolbarEl, dock, statusBar);
    root.append(appEl);

    const vpArea = h('div', { class: 'vp-area' });
    viewport.body.append(vpArea);
    this.viewport = new Viewport(vpArea, {
      onPointer: (p) => this.onPointer(p),
      onSplit: (pos) => this.onSplit(pos),
    });
    this.timeline = new Timeline({
      togglePlay: () => this.togglePlay(),
      restart: () => this.restart(),
      seek: (t) => this.seek(t),
      scrub: (active) => {
        this.scrubbing = active;
      },
      step: (dir) => this.stepFrame(dir),
      setDuration: (d) => this.setPostValue('loopDuration', d),
      setSeamless: (on) => this.setPostValue('seamlessLoop', on),
      setBlend: (f) => this.setPostValue('loopBlend', f),
      setLoopPlayback: (on) => {
        this.loopPlayback = on;
        this.savePlayback();
      },
      setSpeed: (speed) => {
        this.speed = speed;
        this.savePlayback();
      },
      jumpToKeyframe: (i) => this.jumpToKeyframe(i),
      close: () => this.layout.set('timeline', false),
    });
    viewport.body.append(this.timeline.element);
    this.layout.onChange = () => {
      this.dirty = true;
      this.refreshFilmstrip();
    };
    this.loadPlayback();

    this.renderer = new Renderer(this.viewport.canvas);
    this.generatorList = new GeneratorList(browser.body, (id) => this.selectGenerator(id));
    this.paramPanel = new ParamPanel(paramsEl);
    this.postPanel = new ParamPanel(postEl);
    this.colorPanel = new ParamPanel(colorEl);
    this.overridePanel = new ParamPanel(overrideEl);
    this.generalPanel = new ParamPanel(generalEl);
    this.outputPanel = new ParamPanel(outputEl);
    this.animationPanel = new ParamPanel(animationEl);
    this.toolbar = new Toolbar(
      toolbarEl,
      this.viewport.toolbarSlot,
      {
        togglePlay: () => this.togglePlay(),
        restart: () => this.restart(),
        setViewTiles: (n) => this.setViewTiles(n),
        undo: () => this.undo(),
        redo: () => this.redo(),
        exportPng: () => void this.exportPng(),
        exportFlipbook: () => void this.exportFlipbook(),
        share: () => this.share(),
        saveFile: () => this.saveFile(),
        loadFile: () => void this.loadFile(),
      },
      this.layout,
    );

    this.state = this.initialState();
    this.activateGenerator();
    this.bindGlobalEvents();
    requestAnimationFrame(this.frame);
    for (const [id, url] of this.thumbnails.entries()) this.generatorList.setThumbnail(id, url);
    this.generatorList.onVisible = (id) => this.requestThumbnail(id);
    this.generatorList.onHover = (id) => this.previewPresets(id);
    for (const id of this.generatorList.visibleIds()) this.requestThumbnail(id);
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
      ramp: DEFAULT_RAMP,
      postScope: 'global',
      sharedPost: defaultSharedPost(),
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
    this.lastChange = performance.now();
    if (this.loopPlayback) this.time = Math.min(this.time, this.loopDuration);
    this.updateToolbar();
    this.updateSplit();
    this.refreshFilmstrip();
    this.autosave();
  }

  private withParams(values: ParamValues): EditorState {
    return { ...this.state, params: { ...this.state.params, [this.generator.id]: values } };
  }

  private withPost(values: ParamValues): EditorState {
    return withPostValues(this.state, this.generator, values);
  }

  private setPostScope(scope: PostScope): void {
    this.commit(withPostScope(this.state, this.generator, scope));
    this.updateScopeSwitch();
  }

  private updateScopeSwitch(): void {
    for (const b of this.scopeSwitch.querySelectorAll<HTMLButtonElement>('button')) {
      const on = b.dataset.scope === this.state.postScope;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }

  /** Applies a Post Process look preset: every module reset, then the preset's values. */
  private applyPostPreset(preset: Preset): void {
    const look = { ...defaultValues(SCOPED_POST_PARAMS), ...preset.values };
    const post = sanitizeValues(POST_PARAMS, { ...this.post, ...look }, this.post);
    this.commit(this.withPost(post));
    this.syncPanels();
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
    this.inspectorBadge.textContent = CATEGORY_LABELS[def.category];
    this.inspectorBadge.className = `badge cat-${def.category}`;
    this.inspectorDescription.textContent = def.description;
    this.renderPanels();
    this.viewport.setError(null);
    this.viewport.pulse();
    this.clearKeyframes();
    this.timeline.clearFilmstrip();
    if (this.loopPlayback) this.time = Math.min(this.time, this.loopDuration);
    if (def.kind === 'simulation') {
      this.resetSimulation();
      this.viewport.setHint('Left-drag: paint · Right/Shift-drag: erase · Alt/middle-drag: pan');
    } else {
      this.renderer.releaseSimulation();
      this.viewport.setHint(null);
    }
    this.viewport.setPaintable(def.kind === 'simulation');
    this.updateToolbar();
    this.updateSplit();
    this.refreshFilmstrip();
    this.dirty = true;
  }

  private renderPanels(): void {
    const def = this.generator;
    const defaults = postDefaults(def);
    const setPost = (key: string, value: ParamValue) =>
      this.commit(this.withPost({ ...this.post, [key]: value }));
    const resetPost = (defs: readonly ParamDef[]) => {
      const values = { ...this.post };
      for (const d of defs) values[d.key] = defaults[d.key] ?? d.default;
      this.commit(this.withPost(values));
      this.syncPanels();
    };
    const colorModeDef = POST_PROCESS_PARAMS.filter((d) => d.group === 'Color');
    const moduleDefs = POST_PROCESS_PARAMS.filter((d) => d.group !== 'Color');

    this.paramPanel.render({
      defs: def.params,
      values: this.params,
      presets: def.presets,
      groups: def.groups,
      onChange: (key, value) => this.setParam(key, value),
      onPreset: (preset) => this.applyPreset(preset),
      onReset: () => this.replaceParams(defaultValues(def.params)),
    });
    this.overridePanel.render({
      defs: RAMP_OVERRIDE_PARAMS,
      values: this.post,
      defaults,
      groups: [
        {
          name: 'Color ramp override',
          description: 'Replace the shared color ramp for this generator only.',
        },
      ],
      onChange: setPost,
    });
    this.colorPanel.render({
      defs: [...colorModeDef, SHARED_RAMP_PARAM],
      values: this.colorValues(),
      defaults: { ...defaults, ramp: DEFAULT_RAMP },
      groups: POST_MODULES,
      onChange: (key, value) => {
        if (key === 'ramp') this.setSharedRamp(value as GradientValue);
        else setPost(key, value);
      },
    });
    this.postPanel.render({
      defs: moduleDefs,
      values: this.post,
      defaults,
      groups: POST_MODULES,
      moduleStrip: true,
      presets: POST_PRESETS,
      onPreset: (preset) => this.applyPostPreset(preset),
      onChange: setPost,
      onReset: () => resetPost(SCOPED_POST_PARAMS),
    });
    this.generalPanel.render({
      defs: GLOBAL_PARAMS,
      values: this.globalValues(),
      groups: [{ name: 'General', icon: 'tune' }],
      onChange: (key, value) => {
        if (key === 'seed') this.setSeed(value as number);
        else if (key === 'resolution') this.commit({ ...this.state, resolution: value as number });
      },
      actions: [
        {
          label: 'Random seed',
          title: 'Pick a random seed',
          onClick: () => this.setSeed(randomSeed()),
        },
      ],
    });
    this.outputPanel.render({
      defs: OUTPUT_PARAMS,
      values: this.post,
      defaults,
      groups: [{ name: 'Output', icon: 'output', description: 'Exported channels and maps.' }],
      onChange: setPost,
      onReset: () => resetPost(OUTPUT_PARAMS),
    });
    this.animationPanel.render({
      defs: def.animated && def.kind === 'shader' ? TIME_PARAMS : [],
      values: this.post,
      defaults,
      groups: [
        {
          name: 'Animation',
          icon: 'clock',
          description: 'Timeline length and seamless looping (also editable in the timeline).',
          summary: (v) =>
            `${getNumber(v, 'loopDuration').toFixed(1)} s${v.seamlessLoop === true ? ' · seamless' : ''}`,
        },
      ],
      onChange: setPost,
    });
    this.updateScopeSwitch();
  }

  private panels(): ParamPanel[] {
    return [
      this.paramPanel,
      this.overridePanel,
      this.colorPanel,
      this.postPanel,
      this.generalPanel,
      this.animationPanel,
      this.outputPanel,
    ];
  }

  private globalValues(): ParamValues {
    return { seed: this.state.seed, resolution: this.state.resolution };
  }

  private colorValues(): ParamValues {
    return { ...this.post, ramp: this.state.ramp };
  }

  /** Post values as rendered: the ramp is the shared one unless this generator overrides it. */
  private effectivePost(post: ParamValues): ParamValues {
    return {
      ...post,
      gradient: post.overrideRamp === true ? (post.gradient ?? this.state.ramp) : this.state.ramp,
    };
  }

  private setSharedRamp(ramp: GradientValue): void {
    this.commit({ ...this.state, ramp });
    this.presetThumbs.clear();
    this.refreshThumbnails();
  }

  /** Pushes current state into every panel (after undo, file load, presets…). */
  private syncPanels(): void {
    this.paramPanel.setValues(this.params);
    this.overridePanel.setValues(this.post);
    this.colorPanel.setValues(this.colorValues());
    this.postPanel.setValues(this.post);
    this.outputPanel.setValues(this.post);
    this.animationPanel.setValues(this.post);
    this.generalPanel.setValues(this.globalValues());
    this.updateScopeSwitch();
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
    if (preset.post) {
      // Shorthand (e.g. `posterize: 4`) enables modules. Committed right after the params
      // change, so both coalesce into one undo step.
      const post = sanitizeValues(
        POST_PARAMS,
        { ...this.post, ...upgradeLegacyPost(preset.post) },
        this.post,
      );
      this.commit(this.withPost(post));
      this.syncPanels();
    }
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
      this.simFrames = 0;
      this.clearKeyframes();
      this.captureKeyframe(def);
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

  private onSplit(pos: number): void {
    const split = this.generator.split;
    if (!split) return;
    this.setParam(split.key, pos);
    this.paramPanel.setValues(this.params);
  }

  /** Shows the generator's split handle (if any) where its parameter says. */
  private updateSplit(): void {
    const split = this.generator.split;
    const params = this.params;
    const brush = this.generator.params.some((p) => p.key === 'brushSize');
    this.viewport.setBrushRadius(brush ? getNumber(params, 'brushSize', 0.03) : null);
    this.viewport.setSplit(
      split?.visible(params) ? getNumber(params, split.key, 0.5) : null,
      split?.labels,
    );
  }

  // ---- Playback & timeline ------------------------------------------------------------------

  private get loopDuration(): number {
    return getNumber(this.post, 'loopDuration', 4);
  }

  private setPostValue(key: string, value: ParamValue): void {
    this.commit(this.withPost({ ...this.post, [key]: value }));
    this.syncPanels();
  }

  private togglePlay(): void {
    this.playing = !this.playing;
    this.updateToolbar();
  }

  private restart(): void {
    this.time = 0;
    this.resetSimulation();
    this.dirty = true;
  }

  private seek(time: number): void {
    this.time = clamp(time, 0, this.loopDuration);
    this.dirty = true;
  }

  private stepFrame(direction: 1 | -1): void {
    this.playing = false;
    this.updateToolbar();
    const def = this.generator;
    if (def.kind === 'simulation') {
      if (direction > 0) this.stepSimulation(def);
      else {
        // Previous keyframe strictly before the current frame.
        let index = -1;
        this.keyframes.forEach((k, i) => {
          if (k.frame < this.simFrames) index = i;
        });
        if (index >= 0) this.jumpToKeyframe(index);
      }
      return;
    }
    const d = this.loopDuration;
    const frame = Math.round(this.time * TIMELINE_FPS) + direction;
    const frames = Math.max(1, Math.round(d * TIMELINE_FPS));
    this.seek((((frame % frames) + frames) % frames) / TIMELINE_FPS);
  }

  private timelineMode(): 'time' | 'frames' | 'static' {
    const def = this.generator;
    if (def.kind === 'simulation') return 'frames';
    return def.animated ? 'time' : 'static';
  }

  private updateTimeline(): void {
    if (!this.layout.isVisible('timeline')) return;
    const post = this.post;
    this.timeline.update({
      mode: this.timelineMode(),
      playing: this.playing,
      time: this.time,
      duration: this.loopDuration,
      frame: this.simFrames,
      loopPlayback: this.loopPlayback,
      seamless: post.seamlessLoop === true,
      blend: getNumber(post, 'loopBlend', 0.5),
      speed: this.speed,
    });
  }

  private loadPlayback(): void {
    try {
      const saved = JSON.parse(readStorage(PLAYBACK_KEY) ?? '{}') as Record<string, unknown>;
      if ((TIMELINE_SPEEDS as readonly unknown[]).includes(saved.speed))
        this.speed = saved.speed as number;
      if (typeof saved.loop === 'boolean') this.loopPlayback = saved.loop;
    } catch {
      // defaults
    }
  }

  private savePlayback(): void {
    writeStorage(PLAYBACK_KEY, JSON.stringify({ speed: this.speed, loop: this.loopPlayback }));
  }

  // ---- Filmstrip (time mode) ----------------------------------------------------------------

  private filmToken = 0;
  private filmCapture: Capture | null = null;
  private readonly refreshFilmstrip = debounce(() => this.renderFilmstrip(), 450);

  /** Renders evenly spaced frames of the loop into the timeline, a few per tick. */
  private renderFilmstrip(): void {
    const token = ++this.filmToken;
    const def = this.generator;
    if (!this.layout.isVisible('timeline') || def.kind !== 'shader' || !def.animated) {
      this.disposeFilmCapture();
      return;
    }
    const count = this.timeline.filmstripSlots();
    const urls: (string | null)[] = new Array<string | null>(count).fill(null);
    const base = this.frameRequest();
    const duration = this.loopDuration;
    let i = 0;
    const next = () => {
      if (token !== this.filmToken || def !== this.generator) return;
      try {
        this.filmCapture ??= this.renderer.createCapture(FILM_SIZE, FILM_SIZE);
        // One frame per tick keeps the UI responsive on slow GPUs (readPixels is synchronous).
        const time = ((i + 0.5) / count) * duration;
        urls[i] = captureToDataUrl(this.filmCapture, { ...base, time });
        i++;
        this.timeline.setFilmstrip(urls);
        this.dirty = true;
      } catch (e) {
        console.warn('Filmstrip failed', e);
        return;
      }
      if (i < count) setTimeout(next, 30);
      else this.disposeFilmCapture();
    };
    this.timeline.setFilmstrip(urls);
    next();
  }

  private disposeFilmCapture(): void {
    this.filmCapture?.dispose();
    this.filmCapture = null;
  }

  // ---- Simulation keyframes (frames mode) ---------------------------------------------------

  private captureKeyframe(def: SimulationGenerator): void {
    const { sim } = this.renderer.simulationFor(def);
    if (!sim.snapshot || !this.layout.isVisible('timeline')) return;
    if (this.keyframes.length >= MAX_KEYFRAMES) {
      // Keep every other keyframe: the history stays spread over the whole run.
      const kept: Keyframe[] = [];
      this.keyframes.forEach((k, i) => (i % 2 === 0 ? kept.push(k) : k.snapshot.dispose()));
      this.keyframes = kept;
      this.keyInterval *= 2;
    }
    const capture = this.renderer.createCapture(FILM_SIZE, FILM_SIZE);
    try {
      const url = captureToDataUrl(capture, this.exportRequest());
      this.keyframes.push({ frame: this.simFrames, snapshot: sim.snapshot(), url });
      this.timeline.setKeyframes(this.keyframes);
    } catch (e) {
      console.warn('Keyframe capture failed', e);
    } finally {
      capture.dispose();
    }
  }

  private jumpToKeyframe(index: number): void {
    const def = this.simulationDef;
    const key = this.keyframes[index];
    if (!def || !key) return;
    const { sim } = this.renderer.simulationFor(def);
    sim.restore?.(key.snapshot);
    this.simFrames = key.frame;
    // Later keyframes belong to the abandoned future.
    for (const k of this.keyframes.splice(index + 1)) k.snapshot.dispose();
    this.timeline.setKeyframes(this.keyframes);
    this.playing = false;
    this.updateToolbar();
    this.dirty = true;
  }

  private clearKeyframes(): void {
    for (const k of this.keyframes) k.snapshot.dispose();
    this.keyframes = [];
    this.keyInterval = KEYFRAME_INTERVAL;
    this.timeline.setKeyframes([]);
  }

  // ---- Toolbar actions ----------------------------------------------------------------------

  private setSeed(seed: number): void {
    this.commit({ ...this.state, seed: clamp(Math.round(seed), 0, MAX_SEED) });
    this.generalPanel.setValues(this.globalValues());
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
      this.syncPanels();
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
      resolution: this.nativePixelSize() ?? this.state.resolution,
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
      post: this.effectivePost(this.post),
      time: this.time,
      seed: this.state.seed,
    };
  }

  /** Like frameRequest, with the generator's export overrides (no editing overlays). */
  private exportRequest(): FrameRequest {
    const req = this.frameRequest();
    const overrides = req.generator.exportOverrides;
    return overrides ? { ...req, params: { ...req.params, ...overrides } } : req;
  }

  private fileBase(): string {
    return `${this.generator.id}-s${this.state.seed}`;
  }

  /** Pixel blocks per side when the Pixelate module asks for a native-resolution export. */
  private nativePixelSize(): number | null {
    const p = this.post;
    return p.pixelateOn === true && p.pixelExport === true ? getNumber(p, 'pixelate') : null;
  }

  private async exportPng(): Promise<void> {
    const size = this.nativePixelSize() ?? this.state.resolution;
    try {
      const blob = await renderPng(this.renderer, this.exportRequest(), size);
      downloadBlob(blob, `${this.fileBase()}-${size}.png`);
      toast(`Exported ${size}×${size} PNG`);
    } catch (e) {
      toast(`Export failed: ${errorMessage(e)}`, 'error');
    }
  }

  private async exportFlipbook(): Promise<void> {
    const def = this.generator;
    const choice = await askFlipbookOptions(
      def.kind === 'simulation',
      this.renderer.gpu.caps.maxTextureSize,
      { duration: this.loopDuration },
    );
    const native = this.nativePixelSize();
    if (!choice) return;
    const opts = native ? { ...choice, frameSize: native } : choice;
    const count = opts.columns * opts.rows;
    const base = this.exportRequest();
    try {
      const blob = await renderFlipbook(this.renderer, opts, (i) => {
        if (def.kind === 'simulation') {
          const { sim } = this.renderer.simulationFor(def);
          if (i > 0) for (let k = 0; k < opts.stepsBetweenFrames; k++) sim.step(base.params);
          return base;
        }
        // Frames cover [0, duration): with a seamless loop of the same duration, the sheet
        // loops perfectly.
        return { ...base, time: (i / count) * opts.duration };
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
        this.syncPanels();
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
    if (dt > 0) this.frameMs = this.frameMs * 0.8 + dt * 1000 * 0.2;
    // After an interaction rendered at reduced size, redraw once at full size.
    if (this.degraded && now - this.lastChange > ADAPTIVE_IDLE_MS) this.dirty = true;
    const def = this.generator;

    if (!this.failed.has(def.id)) {
      if (def.kind === 'simulation') {
        if (this.pointerActive && !this.playing) this.stepSimulation(def);
        else if (this.playing) {
          this.simAccum = Math.min(this.simAccum + this.speed, 4);
          while (this.simAccum >= 1) {
            this.stepSimulation(def);
            this.simAccum -= 1;
          }
        }
      } else if (this.playing && def.animated && !this.scrubbing) {
        this.advanceTime(dt * this.speed);
      }
      if (this.dirty) this.draw();
    }

    this.updateTimeline();
    this.updateFps(dt);
    requestAnimationFrame(this.frame);
  };

  private advanceTime(dt: number): void {
    const d = this.loopDuration;
    let t = this.time + dt;
    // Loop off: time keeps running (useful to explore beyond the timeline range).
    if (t >= d && this.loopPlayback) t %= d;
    this.time = t;
    this.dirty = true;
  }

  private stepSimulation(def: SimulationGenerator): void {
    try {
      this.renderer.simulationFor(def).sim.step(this.params);
      this.dirty = true;
      ++this.simFrames;
      if (this.simFrames % this.keyInterval === 0) this.captureKeyframe(def);
      if (this.simFrames === SIM_THUMBNAIL_FRAME) this.captureSimulationThumbnail(def);
    } catch (e) {
      this.showRenderError(def.id, e);
    }
  }

  private draw(): void {
    const def = this.generator;
    try {
      // Adaptive preview: while a value is being dragged on a slow frame rate, render at half
      // size to keep the UI responsive; full size comes back as soon as editing pauses.
      const full = Math.min(this.state.resolution, MAX_PREVIEW_SIZE);
      const interacting = performance.now() - this.lastChange < ADAPTIVE_IDLE_MS;
      this.degraded = interacting && this.frameMs > ADAPTIVE_SLOW_MS && full > 256;
      this.renderer.present(this.frameRequest(), {
        size: this.degraded ? full / 2 : full,
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

  /** Snapshot of the running simulation for its tile in the generator browser. */
  private captureSimulationThumbnail(def: SimulationGenerator): void {
    const capture = this.renderer.createCapture(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    try {
      const url = captureToDataUrl(capture, this.exportRequest());
      this.thumbnails.set(def.id, url);
      this.generatorList.setThumbnail(def.id, url);
    } catch (e) {
      console.warn('Simulation thumbnail failed', e);
    } finally {
      capture.dispose();
    }
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
    this.viewport.setStats(`${this.fps} FPS\n${preview}×${preview}`);
    this.statusLeft.textContent = `${this.generator.name} · export ${this.state.resolution}×${this.state.resolution} · seed ${this.state.seed}`;
    this.statusRight.textContent = `${caps.floatTargets ? 'float32' : caps.halfFloatTargets ? 'float16' : '8-bit'} targets · ${caps.renderer}`;
  }

  /** Browser thumbnail of `def` with its defaults, or with `preset` applied. */
  private thumbnailRequest(def: GeneratorDefinition, preset?: Preset): FrameRequest {
    const params = sanitizeValues(def.params, { ...defaultValues(def.params), ...preset?.values });
    const base = postDefaults(def);
    const post = preset?.post
      ? sanitizeValues(POST_PARAMS, { ...base, ...upgradeLegacyPost(preset.post) }, base)
      : base;
    const req = { generator: def, params, post: this.effectivePost(post), time: 1.3, seed: 7 };
    const overrides = def.exportOverrides;
    return overrides ? { ...req, params: { ...req.params, ...overrides } } : req;
  }

  /** Hover preview in the browser: thumbnails of every preset of `id` (rendered once). */
  private readonly presetThumbs = new Map<string, string[]>();

  private previewPresets(id: string): void {
    const def = getGenerator(id);
    if (!def || def.kind !== 'shader' || !def.presets?.length) return;
    const cached = this.presetThumbs.get(id);
    if (cached) {
      this.generatorList.setPresetThumbnails(id, cached);
      return;
    }
    const presets = def.presets.slice(0, 10);
    const urls: string[] = [];
    const capture = this.renderer.createCapture(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    let i = 0;
    const next = () => {
      if (this.generatorList.hoveredId !== id) {
        capture.dispose();
        return; // pointer left: finish another time
      }
      try {
        urls.push(captureToDataUrl(capture, this.thumbnailRequest(def, presets[i])));
      } catch (e) {
        console.warn('Preset thumbnail failed', e);
      }
      this.generatorList.setPresetThumbnails(id, urls);
      if (++i < presets.length) setTimeout(next, 20);
      else {
        capture.dispose();
        this.presetThumbs.set(id, urls);
      }
    };
    next();
  }

  /** Renders generator thumbnails one by one in the background. */
  private readonly thumbQueue: string[] = [];
  private readonly thumbDone = new Set<string>();
  private thumbTimer: ReturnType<typeof setTimeout> | undefined;
  private thumbCapture: Capture | null = null;
  private readonly refreshThumbnails = debounce(() => {
    this.thumbDone.clear();
    for (const id of this.generatorList.visibleIds()) this.requestThumbnail(id);
  }, 500);

  /**
   * Thumbnails are rendered lazily, one per timer tick, only for tiles that scroll into view
   * (simulations get theirs from the live preview instead).
   */
  private requestThumbnail(id: string): void {
    const def = getGenerator(id);
    if (!def || def.kind !== 'shader' || this.thumbDone.has(id) || this.thumbQueue.includes(id))
      return;
    this.thumbQueue.push(id);
    this.thumbTimer ??= setTimeout(() => this.renderNextThumbnail(), 30);
  }

  private renderNextThumbnail(): void {
    this.thumbTimer = undefined;
    const id = this.thumbQueue.shift();
    const def = id ? getGenerator(id) : undefined;
    if (def && def.kind === 'shader') {
      try {
        this.thumbCapture ??= this.renderer.createCapture(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
        const featured = def.presets?.find((p) => p.name === def.featuredPreset);
        const req = this.thumbnailRequest(def, featured);
        this.generatorList.setThumbnail(def.id, captureToDataUrl(this.thumbCapture, req));
        this.thumbDone.add(def.id);
      } catch (e) {
        console.warn(`Thumbnail failed for ${def.id}`, e);
      }
      this.dirty = true;
    }
    if (this.thumbQueue.length > 0)
      this.thumbTimer = setTimeout(() => this.renderNextThumbnail(), 30);
    else {
      this.thumbCapture?.dispose();
      this.thumbCapture = null;
    }
  }

  // ---- Global events ------------------------------------------------------------------------

  private bindGlobalEvents(): void {
    window.addEventListener('keydown', (e) => {
      if (isEditingText()) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.code === 'Space' && !mod) {
        e.preventDefault();
        this.togglePlay();
      } else if (!mod && (e.key === 't' || e.key === 'T')) {
        this.layout.toggle('timeline');
      } else if (!mod && (e.key === ',' || e.key === '.')) {
        this.stepFrame(e.key === '.' ? 1 : -1);
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
