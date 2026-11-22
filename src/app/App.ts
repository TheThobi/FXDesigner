import {
  CATEGORY_LABELS,
  isOperator,
  type GeneratorDefinition,
  type ShaderGenerator,
  type Simulation,
  type SimulationGenerator,
  type SimulationPointer,
  type SimulationSnapshot,
} from '../engine/generator';
import type { RenderTarget } from '../engine/gl/RenderTarget';
import { ShaderCompileError } from '../engine/gl/ShaderProgram';
import { inputsOf, outputsOf, type NodeValueType } from '../engine/nodes';
import { upgradeLegacyPost } from '../engine/post/legacy';
import {
  COLOR_MODE,
  DEFAULT_RAMP,
  OUTPUT_PARAMS,
  POST_MODULES,
  POST_PARAMS,
  POST_PROCESS_PARAMS,
  POST_PRESETS,
  SHARED_RAMP_PARAM,
  TIME_PARAMS,
} from '../engine/post/schema';
import {
  ProgramPending,
  Renderer,
  type Capture,
  type ChainInput,
  type ChainStep,
  type DisplayItem,
  type FrameRequest,
  type NodeTargets,
} from '../engine/Renderer';
import { DEFAULT_GENERATOR_ID, GENERATORS, getGenerator } from '../generators/registry';
import { GRADIENT_PRESETS } from '../params/gradientPresets';
import type { GradientValue } from '../params/gradient';
import type { ParamDef, ParamValue, ParamValues, Preset } from '../params/types';
import { defaultValues, getNumber, sanitizeValues } from '../params/values';
import { confirmDialog, promptDialog } from '../ui/ConfirmDialog';
import { userPresetMenu } from '../ui/UserPresetMenu';
import { h, isEditingText, isTypingText } from '../ui/dom';
import { askExportMaps, type ExportMapsOptions, type MapKind } from '../ui/ExportMapsDialog';
import { CodePanel } from '../ui/CodePanel';
import { askExport, type ExportChoice } from '../ui/ExportDialog';
import { askFlipbookOptions, SIM_FRAMES_PER_SECOND } from '../ui/FlipbookDialog';
import { openLibrary } from '../ui/LibraryDialog';
import { AccountButton } from '../ui/AccountUI';
import { GeneratorList } from '../ui/GeneratorList';
import { icon } from '../ui/icons';
import { DockManager } from '../ui/Dock';
import { Layout } from '../ui/Layout';
import { addPanelClose, dockPanel, tabbedPanel } from '../ui/Panel';
import { ParamPanel } from '../ui/ParamPanel';
import { Timeline, TIMELINE_FPS, TIMELINE_SPEEDS } from '../ui/Timeline';
import { toast } from '../ui/toast';
import { Toolbar } from '../ui/Toolbar';
import { Viewport, type GraphViewNode, type LinkDrop } from '../ui/Viewport';
import { openQuickAdd } from '../ui/QuickAddMenu';
import { mostUsedNodes, recordNodeUsage } from './nodeUsage';
import { debounce } from '../util/debounce';
import { downloadBlob, pickFile } from '../util/download';
import { deepEqual } from '../util/equal';
import { clamp } from '../util/math';
import { MAX_SEED, randomSeed } from '../util/random';
import { createZip } from '../util/zip';
import { shaderReference } from '../engine/shaderBuilder';
import { readStorage, writeStorage } from '../util/storage';
import {
  applyDocument,
  documentFromState,
  DocumentError,
  parseDocument,
  serializeDocument,
  type TextureDocument,
} from './document';
import { captureToDataUrl, flipChannels, renderFlipbook, renderPng, renderPng16 } from './exporter';
import { Cloud } from './cloud';
import { History } from './history';
import { Library } from './library';
import { clearHash, loadSession, readHashDocument, saveSession, shareUrl } from './persistence';
import {
  codeDiffers,
  createNode,
  customParamKey,
  effectiveGenerator,
  sanitizeCustomParams,
  type CustomParamSpec,
  DEFAULT_RESOLUTION,
  evaluationOrder,
  fullEvaluationOrder,
  GLOBAL_PARAMS,
  imageDims,
  inputLinks,
  MAX_PREVIEW_SIZE,
  RESOLUTIONS,
  newNodeId,
  nodeById,
  pickScoped,
  postDefaults,
  SCOPED_POST_PARAMS,
  selectedNode,
  withAddedNode,
  withLink,
  withNode,
  withNodeGenerator,
  withoutLink,
  withoutNode,
  type EditorState,
  type GraphLink,
  type GraphNode,
} from './state';
import { ThumbnailCache } from './thumbnails';
import { UserPresets } from './userPresets';

const THUMBNAIL_SIZE = 64;
/**
 * `?e2e`: no background thumbnails (browser tiles, preset galleries). Software-rendered test
 * browsers would spend most of their time on them.
 */
const LITE = new URLSearchParams(window.location.search).has('e2e');
/** Color ramp presets as gallery presets (only their ramp matters). */
const RAMP_PRESETS: readonly Preset[] = GRADIENT_PRESETS.map((p) => ({
  name: p.name,
  values: {},
  ramp: p.value,
}));
/** Displayed frames a simulation runs before its browser thumbnail is captured. */
const SIM_THUMBNAIL_FRAME = 240;
/** Adaptive preview: frame interval (ms) above which edits render at half size… */
const ADAPTIVE_SLOW_MS = 40;
/** …until no change happened for this long (ms). */
const ADAPTIVE_IDLE_MS = 250;
/** Unselected nodes render at most this size (they are thumbnails in the graph). */
const MAX_UNSELECTED_SIZE = 512;
const MIN_NODE_SIZE = 128;
/** Filmstrip / keyframe image size (px). */
const FILM_SIZE = 48;
/** Simulation keyframes kept for the timeline (older ones are thinned out). */
const MAX_KEYFRAMES = 16;
/** Displayed frames between two simulation keyframes, initially (doubles when thinned). */
const KEYFRAME_INTERVAL = 30;
const PLAYBACK_KEY = 'ptm.ui.playback';
/** Post `output` value of each exported map. */
const MAP_OUTPUT: Readonly<Record<MapKind, number>> = { color: 0, normal: 1, height: 2 };

interface Keyframe {
  readonly frame: number;
  readonly snapshot: SimulationSnapshot;
  readonly url: string;
}

/** What a node looked like right after its last preset (or its defaults). */
interface PresetBaseline {
  /** `${nodeId}:${generatorId}`. */
  readonly key: string;
  readonly params: ParamValues;
  /** Post Process look modules. */
  readonly look: ParamValues;
  readonly ramp: GradientValue;
}

/** Live preview resources of one node. */
interface NodeCache {
  readonly targets: NodeTargets;
  /** Inputs + settings the current image was rendered with. */
  signature: string;
  /** Bumped at each re-render (downstream nodes include it in their signature). */
  version: number;
  /** Simulation steps since its last reset. */
  simFrames: number;
  /** Bumped when the simulation state changes (step, reset, rewind). */
  simVersion: number;
}

function errorMessage(e: unknown): string {
  if (e instanceof ShaderCompileError) return e.annotated();
  return e instanceof Error ? e.message : String(e);
}

function nextPow2(n: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(1, n)));
}

/**
 * Application controller: owns the editor state (a graph of generator nodes) and wires UI
 * events, the renderer and the animation loop together. UI components never mutate state
 * directly; they call back here. The Details panel, timeline and exports work on the
 * selected node.
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
  /** Keyframe index restored by the timeline, until the simulation steps again. */
  private rewoundTo: number | null = null;
  private pointerActive = false;
  /** Nodes whose generator failed to compile / render (id -> message). */
  private readonly failed = new Map<string, string>();
  private readonly nodeCaches = new Map<string, NodeCache>();
  /** Bumped when an asynchronous asset (imported image) becomes available. */
  private assetVersion = 0;

  private readonly renderer: Renderer;
  private readonly viewport: Viewport;
  private readonly toolbar: Toolbar;
  private readonly generatorList: GeneratorList;
  private readonly paramPanel: ParamPanel;
  private readonly postPanel: ParamPanel;
  private readonly colorPanel: ParamPanel;
  private readonly outputPanel: ParamPanel;
  private readonly animationPanel: ParamPanel;
  private readonly generalPanel: ParamPanel;
  private readonly timeline: Timeline;
  private readonly layout: Layout;
  private readonly dock: DockManager;
  private readonly inspectorTitle: HTMLElement;
  private readonly inspectorDescription: HTMLElement;
  /** Covers the Details panel while several nodes are selected. */
  private readonly multiInfo: HTMLElement;
  private readonly inspectorBadge: HTMLElement;
  /** GLSL view of the selected node (Code button of the Generator page). */
  private readonly codePanel = new CodePanel();
  private readonly codeBtn: HTMLButtonElement;
  private codeOpen = false;
  /** Preset previewed live while the pointer rests on a gallery tile. */
  private hoverPreview: GraphNode | null = null;
  /** Preset gallery thumbnails, by preview content. */
  private readonly galleryThumbs = new Map<string, string>();
  private readonly galleryQueue: {
    key: string;
    node: GraphNode;
    done: (url: string | null) => void;
  }[] = [];
  private galleryCapture: Capture | null = null;
  private galleryTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly refreshGalleries = debounce(() => {
    this.paramPanel.reloadThumbnails();
    this.postPanel.reloadThumbnails();
    this.colorPanel.reloadThumbnails();
  }, 700);
  private readonly statusLeft: HTMLElement;
  private readonly statusMid: HTMLElement;
  private readonly statusRight: HTMLElement;
  /** Saved systems; the current one receives the autosave. */
  private readonly library = new Library();
  /** Account and library sync (inactive when the server has no accounts). */
  private readonly cloud = new Cloud(this.library);
  private account: AccountButton | null = null;
  private systemId = '';
  /** Detected kind (grayscale / color) of each node's main output, for pins and links. */
  private readonly valueTypes = new Map<string, NodeValueType>();
  private readonly typeChecks = new Map<
    string,
    { readonly version: number; readonly at: number }
  >();
  private readonly thumbnails = new ThumbnailCache();
  /** Node and generator the panels currently show (rebuilt when either changes). */
  private shownKey = '';

  private lastFrame = 0;
  /** Time of the last state change, to detect interactive editing (adaptive preview). */
  private lastChange = 0;
  /** Smoothed frame interval (ms). */
  private frameMs = 16;
  private degraded = false;
  private fpsFrames = 0;
  private fpsElapsed = 0;
  private fps = 0;

  private readonly autosave = debounce(() => this.saveSystem(), 400);

  constructor(root: HTMLElement) {
    const toolbarEl = h('header', { class: 'toolbar' });
    const appEl = h('div', { class: 'app' });
    this.layout = new Layout(appEl);
    const browser = dockPanel('browser', 'Browser', 'texture', 'aside', () =>
      this.layout.set('browser', false),
    );
    const viewport = dockPanel('viewport', 'Viewport', 'viewport', 'main');
    const details = tabbedPanel('details', { text: 'Details', icon: 'details' }, [
      { id: 'generator', title: 'Generator', icon: 'tune' },
      { id: 'post', title: 'Post Process', icon: 'fx' },
      { id: 'output', title: 'Output', icon: 'download' },
    ]);
    addPanelClose(details.panel, 'Hide the details panel', () => this.layout.set('details', false));
    this.multiInfo = h('div', { class: 'multi-select-info', hidden: true });
    details.panel.append(this.multiInfo);

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
    const generalEl = h('div');
    const outputEl = h('div');
    const animationEl = h('div');
    this.codeBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-small code-toggle',
        title: 'Show the GLSL of this node; editing it makes the node custom',
        onclick: () => {
          this.codeOpen = !this.codeOpen;
          this.renderCode();
        },
      },
      h('span', { class: 'code-glyph', text: '</>' }),
      'Code',
    );
    details.pages.generator!.append(
      h(
        'div',
        { class: 'inspector-header' },
        h(
          'div',
          { class: 'inspector-title' },
          this.inspectorTitle,
          this.inspectorBadge,
          this.codeBtn,
        ),
        this.inspectorDescription,
      ),
      this.codePanel.element,
      paramsEl,
    );
    details.pages.post!.append(colorEl, postEl);
    details.pages.output!.append(
      h(
        'div',
        { class: 'page-intro-row' },
        h('p', { class: 'page-intro', text: 'Settings shared by all nodes, and export maps.' }),
        h(
          'button',
          {
            class: 'btn btn-small',
            title: 'Restore the output and animation settings of this node',
            onclick: () => this.resetOutput(),
          },
          icon('reset', 12),
          'Reset all',
        ),
      ),
      generalEl,
      animationEl,
      outputEl,
    );

    // Stats: thin bar at the bottom of the page (Layout → Stats).
    this.statusLeft = h('span', { class: 'status-left' });
    this.statusMid = h('span', { class: 'status-mid' });
    this.statusRight = h('span', { class: 'status-right' });
    const statusBar = h(
      'footer',
      { class: 'statusbar' },
      this.statusLeft,
      this.statusMid,
      this.statusRight,
    );

    const dock = h('div', { class: 'dock' });
    this.dock = new DockManager(
      dock,
      [
        { id: 'browser', title: 'Browser', icon: 'texture', element: browser.panel },
        { id: 'viewport', title: 'Viewport', icon: 'viewport', element: viewport.panel },
        { id: 'details', title: 'Details', icon: 'details', element: details.panel },
      ],
      this.layout,
      () => window.dispatchEvent(new Event('resize')),
    );
    this.layout.onReset = () => this.dock.reset();
    appEl.append(toolbarEl, dock, statusBar);
    root.append(appEl);

    const vpArea = h('div', { class: 'vp-area' });
    viewport.body.append(vpArea);
    this.viewport = new Viewport(vpArea, {
      onPointer: (p) => this.onPointer(p),
      onSplit: (pos) => this.onSplit(pos),
      onSelect: (id) => this.selectNode(id),
      onSelection: (ids) => this.showMultiSelection(ids),
      onMove: (moves) =>
        this.commit(moves.reduce((s, m) => withNode(s, m.id, { x: m.x, y: m.y }), this.state)),
      onConnect: (from, output, to, input) => this.connect(from, output, to, input),
      onDisconnect: (to, input) => this.commit(withoutLink(this.state, to, input)),
      onDelete: (id) => this.deleteNode(id),
      onTogglePost: (id) => this.setNodePost(id, !nodeById(this.state, id)?.postEnabled),
      onToggleFreeze: (id) => this.toggleFreeze(id),
      onToggleCollapse: (id) => this.toggleCollapse(id),
      onLinkDrop: (drop) => this.quickAdd(drop),
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
      this.dock.refresh();
      this.refreshFilmstrip();
    };
    this.loadPlayback();

    this.renderer = new Renderer(this.viewport.canvas);
    // An imported image finished decoding: every signature changes once, nodes re-render.
    this.renderer.images.onLoad = () => this.assetVersion++;
    this.generatorList = new GeneratorList(
      browser.body,
      (id) => this.setNodeGenerator(id),
      (id) => this.addNode(id),
    );
    this.generatorList.dropTarget = {
      hover: (x, y) => this.viewport.setDropHighlight(this.viewport.dropPosition(x, y) !== null),
      drop: (id, x, y) => {
        const at = this.viewport.dropPosition(x, y);
        if (at) this.addNode(id, at);
      },
      end: () => this.viewport.setDropHighlight(false),
    };
    this.paramPanel = new ParamPanel(paramsEl);
    this.postPanel = new ParamPanel(postEl);
    this.colorPanel = new ParamPanel(colorEl);
    this.generalPanel = new ParamPanel(generalEl);
    this.outputPanel = new ParamPanel(outputEl);
    this.animationPanel = new ParamPanel(animationEl);
    this.toolbar = new Toolbar(
      toolbarEl,
      this.viewport.toolbarSlot,
      {
        setViewTiles: (n) => this.setViewTiles(n),
        undo: () => this.undo(),
        redo: () => this.redo(),
        openExport: () => void this.openExport(),
        openLibrary: () => this.openLibrary(),
        newSystem: () => this.newSystem(),
        renameSystem: () => void this.renameSystem(this.systemId),
        saveLibrary: () => this.saveLibraryFile(),
        loadLibrary: () => void this.loadLibraryFile(),
        saveFile: () => this.saveFile(),
        loadFile: () => void this.loadFile(),
      },
      this.layout,
    );

    this.account = new AccountButton({
      login: (login, password) => this.cloud.login(login, password),
      register: (pseudo, email, password) => this.cloud.register(pseudo, email, password),
      discord: () => {
        this.saveSystem(true);
        this.cloud.discordSignIn();
      },
      logout: () => this.cloud.logout(),
      syncNow: () => this.cloud.sync(),
      openLibrary: () => this.openLibrary(),
    });
    this.toolbar.accountSlot.append(this.account.element);
    this.cloud.onState = () => this.updateAccount();
    this.cloud.onRemoteChange = (ids) => this.onRemoteLibraryChange(ids);

    this.state = this.initialState();
    this.renderer.gpu.workspaceAspect = this.state.aspect;
    this.viewport.setAspect(this.state.aspect);
    this.syncGraph();
    this.activateNode();
    this.bindGlobalEvents();
    requestAnimationFrame(this.frame);
    for (const [id, url] of this.thumbnails.entries()) this.generatorList.setThumbnail(id, url);
    this.generatorList.onVisible = (id) => this.requestThumbnail(id);
    this.generatorList.onHover = (id) => this.previewPresets(id);
    for (const id of this.generatorList.visibleIds()) this.requestThumbnail(id);
    this.showAuthError();
    void this.cloud.init();
  }

  // ---- Account ------------------------------------------------------------------------------

  private updateAccount(): void {
    const h = this.cloud.health;
    this.account?.update({
      available: this.cloud.available,
      discord: h?.discord === true,
      registration: h?.registration !== false,
      user: this.cloud.user,
      status: this.cloud.statusText(),
      busy: this.cloud.syncing,
    });
  }

  /** The server replaced or removed systems: reload the open one if it is among them. */
  private onRemoteLibraryChange(ids: readonly string[]): void {
    if (!ids.includes(this.systemId)) return;
    if (this.library.get(this.systemId)) this.switchSystem(this.systemId, false);
    else {
      const next = this.library.list()[0];
      if (next) this.switchSystem(next.id, false);
      else this.newSystem(false);
    }
  }

  /** A failed Discord sign-in comes back as ?auth_error=… */
  private showAuthError(): void {
    const url = new URL(window.location.href);
    const error = url.searchParams.get('auth_error');
    if (!error) return;
    toast(error, 'error', 6000);
    url.searchParams.delete('auth_error');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  // ---- State -------------------------------------------------------------------------------

  /** The selected node (Details panel, timeline, exports). */
  private get node(): GraphNode {
    return selectedNode(this.state);
  }

  private get generator(): GeneratorDefinition {
    return getGenerator(this.node.generator) ?? GENERATORS[0]!;
  }

  /** The selected node's generator with its custom parameters (Code view), if any. */
  private get nodeDef(): GeneratorDefinition {
    return effectiveGenerator(this.generator, this.node);
  }

  private get params(): ParamValues {
    return this.node.params;
  }

  private get post(): ParamValues {
    return this.node.post;
  }

  private get ramp(): GradientValue {
    return this.node.ramp;
  }

  private document(): TextureDocument {
    return documentFromState(this.state, getGenerator);
  }

  /** A new graph: one default node. */
  private blankState(): EditorState {
    const def = getGenerator(DEFAULT_GENERATOR_ID) ?? GENERATORS[0]!;
    return {
      nodes: [createNode(def, 'n1', 0, 0)],
      links: [],
      selectedId: 'n1',
      resolution: DEFAULT_RESOLUTION,
      seed: 1,
      aspect: 1,
    };
  }

  /**
   * Startup document: a share link (opened as a new system), else the current library system,
   * else the pre-library autosave (adopted as a system), else a blank system.
   */
  private initialState(): EditorState {
    const adopt = (name: string, state: EditorState) => {
      const entry = this.library.create(name, documentFromState(state, getGenerator));
      this.systemId = entry.id;
      this.library.setCurrent(entry.id);
      return state;
    };
    try {
      const fromHash = readHashDocument();
      if (fromHash) {
        clearHash();
        const doc = parseDocument(fromHash, getGenerator);
        toast('Loaded shared texture');
        return adopt('Shared system', applyDocument(doc));
      }
    } catch (e) {
      clearHash();
      toast(`Invalid share link: ${errorMessage(e)}`, 'error');
    }
    const current = this.library.currentId;
    if (current) {
      try {
        const state = applyDocument(parseDocument(this.library.load(current), getGenerator));
        this.systemId = current;
        return state;
      } catch {
        // Unreadable system: fall back to the autosave.
      }
    }
    try {
      const session = loadSession();
      if (session) return adopt('My system', applyDocument(parseDocument(session, getGenerator)));
    } catch {
      // Stale or incompatible autosave: start fresh.
    }
    return adopt('Untitled system', this.blankState());
  }

  // ---- Library ------------------------------------------------------------------------------

  private get systemName(): string {
    return this.library.get(this.systemId)?.name ?? 'Untitled system';
  }

  /** Autosave: the current system (and the session, for older builds). */
  private saveSystem(withThumbnail = false): void {
    const doc = this.document();
    saveSession(doc);
    if (this.systemId)
      this.library.save(this.systemId, doc, withThumbnail ? this.systemThumbnail() : undefined);
  }

  /** Small image of the selected node, for the library card. */
  private systemThumbnail(): string | null {
    const [w, hgt] = imageDims(112, this.state.aspect);
    let capture: Capture | null = null;
    try {
      capture = this.renderer.createCapture(w, hgt);
      return captureToDataUrl(capture, this.chainFor(this.node.id, this.time, true));
    } catch {
      return null;
    } finally {
      capture?.dispose();
    }
  }

  private openLibrary(): void {
    this.saveSystem(true);
    openLibrary({
      list: () => this.library.list(),
      folders: () => this.library.folders(),
      currentId: () => this.systemId,
      open: (id) => this.switchSystem(id),
      create: (folder) => this.newSystem(true, folder),
      move: (id, folder) => this.library.move(id, folder),
      createFolder: async () => {
        const name = await promptDialog({
          title: 'New folder',
          label: 'Name',
          confirmLabel: 'Create',
        });
        return name ? this.library.createFolder(name).id : null;
      },
      renameFolder: async (id) => {
        const name = await promptDialog({
          title: 'Rename folder',
          label: 'Name',
          value: this.library.folder(id)?.name ?? '',
          confirmLabel: 'Rename',
        });
        if (name) this.library.renameFolder(id, name);
      },
      removeFolder: async (id) => {
        const folder = this.library.folder(id);
        if (!folder) return;
        const ok = await confirmDialog({
          title: `Delete the folder "${folder.name}"?`,
          message: 'Its systems are kept and moved out of the folder.',
          confirmLabel: 'Delete folder',
        });
        if (ok) this.library.removeFolder(id);
      },
      status: () => this.cloud.statusText(),
      duplicate: (id) => {
        if (id === this.systemId) this.saveSystem(true);
        this.library.duplicate(id);
      },
      rename: (id) => this.renameSystem(id),
      remove: async (id) => {
        const entry = this.library.get(id);
        if (!entry) return;
        const ok = await confirmDialog({
          title: `Delete "${entry.name}"?`,
          message: 'The system is removed from this browser. This cannot be undone.',
          confirmLabel: 'Delete',
        });
        if (!ok) return;
        this.library.remove(id);
        if (id !== this.systemId) return;
        const next = this.library.list()[0];
        if (next) this.switchSystem(next.id, false);
        else this.newSystem(false);
      },
    });
  }

  private async renameSystem(id: string): Promise<void> {
    const name = await promptDialog({
      title: 'Rename system',
      label: 'Name',
      value: this.library.get(id)?.name ?? '',
      confirmLabel: 'Rename',
    });
    if (!name) return;
    this.library.rename(id, name);
    this.updateToolbar();
  }

  /** File → Save library: every system in one JSON file. */
  private saveLibraryFile(): void {
    this.saveSystem(true);
    const blob = new Blob([JSON.stringify(this.library.exportAll())], {
      type: 'application/json',
    });
    downloadBlob(blob, 'fx-designer-library.json');
  }

  /** File → Open library: adds the systems of a library file (current system kept). */
  private async loadLibraryFile(): Promise<void> {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const added = this.library.importAll(JSON.parse(await file.text()) as unknown, (doc) => {
        try {
          parseDocument(doc, getGenerator);
          return true;
        } catch {
          return false;
        }
      });
      toast(`Added ${added.length} system${added.length === 1 ? '' : 's'} to the library`);
      if (added.length) this.openLibrary();
    } catch (e) {
      toast(`Cannot open this library: ${errorMessage(e)}`, 'error');
    }
  }

  /** Opens library system `id` (the current one is saved first). */
  private switchSystem(id: string, saveFirst = true): void {
    if (saveFirst) this.saveSystem(true);
    try {
      const doc = parseDocument(this.library.load(id), getGenerator);
      this.systemId = id;
      this.library.setCurrent(id);
      this.loadState(applyDocument(doc));
      toast(`Opened "${this.systemName}"`);
    } catch (e) {
      toast(`Cannot open this system: ${errorMessage(e)}`, 'error');
    }
  }

  /** Starts a new, empty system in the library. */
  private newSystem(saveFirst = true, folder: string | null = null): void {
    if (saveFirst) this.saveSystem(true);
    const state = this.blankState();
    const entry = this.library.create(
      'Untitled system',
      documentFromState(state, getGenerator),
      folder,
    );
    this.systemId = entry.id;
    this.library.setCurrent(entry.id);
    this.loadState(state);
  }

  /** Replaces the whole graph by another document (no undo across documents). */
  private loadState(state: EditorState): void {
    this.history.clear();
    this.valueTypes.clear();
    this.typeChecks.clear();
    this.commit(state, { record: false });
    this.shownKey = '';
    this.activateNode();
    this.resetAllSimulations(true);
    this.viewport.fit();
    this.updateToolbar();
  }

  /** Single entry point for state changes (undo recording, UI sync, autosave). */
  private commit(next: EditorState, opts: { record?: boolean } = {}): void {
    if (next === this.state) return;
    if (opts.record !== false) this.history.record(this.state);
    const prev = this.state;
    this.state = next;
    this.lastChange = performance.now();
    // An edited node gets another chance (e.g. fixed custom code); failures are per node.
    for (const node of next.nodes) {
      if (!this.failed.has(node.id) || prev.nodes.includes(node)) continue;
      this.failed.delete(node.id);
      if (node.id === next.selectedId) this.viewport.setError(null);
    }
    if (prev.aspect !== next.aspect) this.applyAspect();
    this.syncGraph();
    const key = `${this.node.id}:${this.node.generator}`;
    if (key !== this.shownKey) this.activateNode();
    if (this.loopPlayback) this.time = Math.min(this.time, this.loopDuration);
    this.updateToolbar();
    this.updateSplit();
    this.refreshFilmstrip();
    this.autosave();
    if (prev.nodes !== next.nodes || prev.links !== next.links) this.refreshGalleries();
  }

  private withParams(values: ParamValues): EditorState {
    return withNode(this.state, this.node.id, { params: values });
  }

  private withPost(values: ParamValues): EditorState {
    return withNode(this.state, this.node.id, { post: values });
  }

  // ---- Graph --------------------------------------------------------------------------------

  /** Pushes the graph to the viewport and frees resources of removed nodes. */
  private syncGraph(): void {
    const nodes: GraphViewNode[] = this.state.nodes.map((n) => {
      const def = getGenerator(n.generator) ?? GENERATORS[0]!;
      const custom =
        n.code !== undefined && def.kind === 'shader' && codeDiffers(n.code, def.fragment);
      return {
        id: n.id,
        title: custom ? `${def.name} · custom` : def.name,
        category: def.category,
        x: n.x,
        y: n.y,
        postEnabled: n.postEnabled,
        frozen: n.frozenAt !== null,
        inputs: inputsOf(def),
        outputs: outputsOf(def),
        failed: this.failed.has(n.id),
        collapsed: n.collapsed === true,
        outputType: this.valueTypes.get(n.id) ?? null,
      };
    });
    this.viewport.setGraph(nodes, this.state.links, this.state.selectedId);
    this.updateInputParams();
    const ids = new Set(this.state.nodes.map((n) => n.id));
    for (const [id, cache] of this.nodeCaches) {
      if (ids.has(id)) continue;
      cache.targets.dispose();
      this.nodeCaches.delete(id);
    }
    for (const id of this.failed.keys()) if (!ids.has(id)) this.failed.delete(id);
    for (const id of this.valueTypes.keys()) if (!ids.has(id)) this.valueTypes.delete(id);
    for (const id of this.typeChecks.keys()) if (!ids.has(id)) this.typeChecks.delete(id);
    const sims = new Set(
      this.state.nodes
        .filter((n) => getGenerator(n.generator)?.kind === 'simulation')
        .map((n) => n.id),
    );
    this.renderer.retainSimulations(sims);
  }

  /** Greys out the selected node's settings that belong to an unconnected input. */
  private updateInputParams(): void {
    const linked = inputLinks(this.state.links, this.node.id);
    const off = new Set<string>();
    for (const input of inputsOf(this.generator))
      if (!linked[input.key]) for (const key of input.params ?? []) off.add(key);
    this.paramPanel.setDisabled(off, 'Connect the matching input to use this setting');
  }

  private selectNode(id: string): void {
    if (id === this.state.selectedId || !nodeById(this.state, id)) return;
    // Selection is not an undoable edit.
    this.commit({ ...this.state, selectedId: id }, { record: false });
  }

  /** Adds a node running `generatorId`, at `at` (graph units) or next to the selected node. */
  private addNode(generatorId: string, at?: [number, number]): void {
    const def = getGenerator(generatorId);
    if (!def) return;
    const [x, y] = at ?? this.viewport.placementNear(this.state.selectedId);
    // New nodes start from the default look: one node's colors never leak into others.
    const node = createNode(def, newNodeId(this.state.nodes), x, y);
    recordNodeUsage(def.id);
    // A Custom Shader is written in code: show its Code view.
    if (def.id === 'custom-shader') this.codeOpen = true;
    this.commit(withAddedNode(this.state, node));
  }

  /**
   * A link was dropped on empty space: offer the most used nodes and a search, then create
   * the chosen node there, already connected (one undoable step).
   */
  private quickAdd(drop: LinkDrop): void {
    const fromOutput = drop.from !== undefined;
    // From an output the new node needs an input; from an input, any node with an output.
    const candidates = GENERATORS.filter((d) => (fromOutput ? inputsOf(d).length > 0 : true));
    const item = (d: GeneratorDefinition) => ({
      id: d.id,
      name: d.name,
      label: CATEGORY_LABELS[d.category],
    });
    openQuickAdd({
      x: drop.client[0],
      y: drop.client[1],
      title: fromOutput ? 'Connect to a new node' : 'Feed this input from a new node',
      suggestions: mostUsedNodes(candidates).map(item),
      all: candidates.map(item),
      onPick: (id) => {
        const def = getGenerator(id);
        if (!def) return;
        const [x, y] = this.viewport.nodeOriginForPin(drop.world, fromOutput ? 'input' : 'output');
        const node = createNode(def, newNodeId(this.state.nodes), x, y);
        recordNodeUsage(def.id);
        let next = withAddedNode(this.state, node);
        if (drop.from) {
          const input = inputsOf(def)[0]?.key;
          if (input) {
            const { node: from, output } = drop.from;
            next = withLink(
              next,
              output ? { from, to: node.id, input, output } : { from, to: node.id, input },
            );
          }
        } else if (drop.to) {
          const output = outputsOf(def)[0]?.key;
          const { node: to, input } = drop.to;
          next = withLink(
            next,
            output ? { from: node.id, to, input, output } : { from: node.id, to, input },
          );
        }
        this.commit(next);
      },
    });
  }

  private deleteNode(id: string): void {
    this.deleteNodes([id]);
  }

  /** Deletes nodes in one undoable step (at least one node always remains). */
  private deleteNodes(ids: readonly string[]): void {
    if (this.state.nodes.length <= 1) {
      toast('The last node cannot be deleted', 'error');
      return;
    }
    let next = this.state;
    for (const id of ids) next = withoutNode(next, id);
    this.commit(next);
  }

  /**
   * Several nodes selected: the Details panel shows the selection (they move together, Del
   * deletes them) instead of one node's settings.
   */
  private showMultiSelection(ids: readonly string[]): void {
    const el = this.multiInfo;
    el.hidden = ids.length < 2;
    if (el.hidden) return;
    const items = ids.map((id) => {
      const node = nodeById(this.state, id);
      const def = node ? getGenerator(node.generator) : undefined;
      return h(
        'li',
        {},
        h('button', {
          class: 'multi-item',
          title: 'Edit this node alone',
          text: def?.name ?? id,
          onclick: () => this.viewport.selectOnly(id),
        }),
      );
    });
    el.replaceChildren(
      h('h2', { text: `${ids.length} nodes selected` }),
      h('p', {
        class: 'description',
        text:
          'Drag one of them to move them together. Shift+click adds or removes a node, Del ' +
          'deletes the selection. Click a node (or a name below) to edit it.',
      }),
      h('ul', { class: 'multi-list' }, ...items),
      h(
        'div',
        { class: 'multi-actions' },
        h('button', {
          class: 'btn',
          text: `Delete ${ids.length} nodes`,
          onclick: () => this.deleteNodes(ids),
        }),
      ),
    );
  }

  private connect(from: string, output: string | undefined, to: string, input: string): void {
    const next = withLink(this.state, output ? { from, to, input, output } : { from, to, input });
    if (next === this.state) {
      toast('That link would create a loop', 'error');
      return;
    }
    this.commit(next);
  }

  /** Freeze frame: the node keeps the image of the current time (simulations stop stepping). */
  private toggleCollapse(id: string): void {
    const node = nodeById(this.state, id);
    if (node) this.commit(withNode(this.state, id, { collapsed: !node.collapsed }));
  }

  private toggleFreeze(id: string): void {
    const node = nodeById(this.state, id);
    if (!node) return;
    this.commit(withNode(this.state, id, { frozenAt: node.frozenAt === null ? this.time : null }));
  }

  /** Workspace aspect changed: sims are rebuilt with the new grid proportions. */
  private applyAspect(): void {
    this.renderer.gpu.workspaceAspect = this.state.aspect;
    this.viewport.setAspect(this.state.aspect);
    this.resetAllSimulations(true);
    requestAnimationFrame(() => this.viewport.fit());
  }

  private setNodePost(id: string, enabled: boolean): void {
    this.commit(withNode(this.state, id, { postEnabled: enabled }));
  }

  /** Swaps the selected node's generator (generator browser click). */
  private setNodeGenerator(id: string): void {
    const def = getGenerator(id);
    if (!def || id === this.node.generator) return;
    this.commit(withNodeGenerator(this.state, this.node.id, def, this.generator));
  }

  // ---- Post presets -------------------------------------------------------------------------

  /** Applies a Post Process look preset: every module reset, then the preset's values. */
  private async applyPostPreset(preset: Preset): Promise<void> {
    const node = this.node;
    const baseline = this.baselineFor(node);
    if (!deepEqual(pickScoped(this.post), baseline.look)) {
      const ok = await confirmDialog({
        title: `Apply look "${preset.name}"?`,
        message: 'Every Post Process module is reset first: your current look changes are lost.',
        confirmLabel: 'Apply look',
        dontAskKey: 'postPreset',
      });
      if (!ok || node.id !== this.node.id) return;
    }
    const look = { ...defaultValues(SCOPED_POST_PARAMS), ...preset.values };
    const post = sanitizeValues(POST_PARAMS, { ...this.post, ...look }, this.post);
    this.commit(this.withPost(post));
    this.baseline = { ...baseline, look: pickScoped(this.post) };
    this.syncPanels();
  }

  // ---- Panels -------------------------------------------------------------------------------

  /** Rebuilds node-dependent UI and GPU state after the selection or its generator changed. */
  private activateNode(): void {
    const node = this.node;
    const def = this.generator;
    this.shownKey = `${node.id}:${node.generator}`;
    this.generatorList.setActive(def.id);
    this.inspectorTitle.textContent = def.name;
    this.inspectorBadge.textContent = CATEGORY_LABELS[def.category];
    this.inspectorBadge.className = `badge cat-${def.category}`;
    this.inspectorDescription.textContent = def.description;
    this.hoverPreview = null;
    this.renderPanels();
    this.renderCode();
    this.viewport.setError(this.failed.get(node.id) ?? null);
    this.viewport.pulse();
    this.clearKeyframes();
    this.timeline.clearFilmstrip();
    if (this.loopPlayback) this.time = Math.min(this.time, this.loopDuration);
    if (def.kind === 'simulation') {
      this.viewport.setHint('Left-drag: paint · Right/Shift-drag: erase · Alt/middle-drag: pan');
      const live = this.renderer.simulationFor(def, node.id);
      if (live.created || this.simFrames === 0) this.resetSimulation(node);
      else this.captureKeyframe(def);
    } else {
      this.viewport.setHint(null);
    }
    this.viewport.setPaintable(def.kind === 'simulation');
    this.updateToolbar();
    this.updateSplit();
    this.refreshFilmstrip();
    this.updateInputParams();
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
      defs: this.nodeDef.params,
      values: this.params,
      gallery: {
        title: 'Presets',
        presets: def.presets ?? [],
        userPresets: this.userPresets.list(def.id),
        extras: [this.userPresetButton(def)],
        onPick: (preset) => void this.applyPreset(preset),
        // Simulations can't show a preset without running it: no live preview, no thumbnail.
        ...(def.kind === 'shader'
          ? {
              onHover: (preset: Preset | null) => this.previewPreset('params', preset),
              thumbnail: (preset: Preset) => this.presetThumbnail('params', preset),
            }
          : {}),
      },
      groups: def.groups,
      onChange: (key, value) => this.setParam(key, value),
      onReset: () => this.replaceParams(defaultValues(this.nodeDef.params)),
    });
    this.colorPanel.render({
      defs: [...colorModeDef, SHARED_RAMP_PARAM],
      values: this.colorValues(),
      defaults: { ...defaults, ramp: DEFAULT_RAMP },
      groups: POST_MODULES,
      gallery: {
        title: 'Color presets',
        position: 'bottom',
        // Only gradient-map mode uses the ramp.
        visibleWhen: (v) => v.colorMode === COLOR_MODE.gradient,
        presets: RAMP_PRESETS,
        onPick: (preset) => {
          if (!preset.ramp) return;
          this.commit(
            withNode(this.state, this.node.id, {
              ramp: preset.ramp,
              post: { ...this.post, colorMode: COLOR_MODE.gradient },
            }),
          );
          this.syncPanels();
        },
        onHover: (preset) => this.previewPreset('ramp', preset),
        thumbnail: (preset) => this.presetThumbnail('ramp', preset),
      },
      onChange: (key, value) => {
        if (key === 'ramp') this.setRamp(value as GradientValue);
        else setPost(key, value);
      },
    });
    this.postPanel.render({
      defs: moduleDefs,
      values: this.post,
      defaults,
      groups: POST_MODULES,
      gallery: {
        title: 'Looks',
        presets: POST_PRESETS,
        onPick: (preset) => void this.applyPostPreset(preset),
        onHover: (preset) => this.previewPreset('look', preset),
        thumbnail: (preset) => this.presetThumbnail('look', preset),
      },
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
        else if (key === 'aspect') this.commit({ ...this.state, aspect: value as number });
      },
      rowExtras: {
        seed: h(
          'button',
          {
            type: 'button',
            class: 'icon-btn',
            title: 'Random seed',
            'aria-label': 'Random seed',
            onclick: () => this.setSeed(randomSeed()),
          },
          icon('dice', 14),
        ),
      },
    });
    this.outputPanel.render({
      defs: OUTPUT_PARAMS,
      values: this.post,
      defaults,
      groups: [{ name: 'Output', icon: 'output' }],
      onChange: setPost,
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
  }

  private panels(): ParamPanel[] {
    return [
      this.paramPanel,
      this.colorPanel,
      this.postPanel,
      this.generalPanel,
      this.animationPanel,
      this.outputPanel,
    ];
  }

  private globalValues(): ParamValues {
    return { seed: this.state.seed, resolution: this.state.resolution, aspect: this.state.aspect };
  }

  private colorValues(): ParamValues {
    return { ...this.post, ramp: this.ramp };
  }

  /** Output tab "Reset all": the node's output and animation settings. */
  private resetOutput(): void {
    const defaults = postDefaults(this.generator);
    const values = { ...this.post };
    for (const d of [...OUTPUT_PARAMS, ...TIME_PARAMS])
      values[d.key] = defaults[d.key] ?? d.default;
    this.commit(this.withPost(values));
    this.syncPanels();
  }

  // ---- Code view ----------------------------------------------------------------------------

  /** Shows / hides the GLSL view of the selected node and fills it. */
  private renderCode(): void {
    const def = this.generator;
    const convertible = def.kind === 'shader' && !def.codeParam;
    this.codeBtn.hidden = !convertible;
    this.codeBtn.classList.toggle('on', this.codeOpen);
    this.codeBtn.setAttribute('aria-pressed', String(this.codeOpen));
    const show = convertible && this.codeOpen;
    this.codePanel.element.hidden = !show;
    if (!show || def.kind !== 'shader') return;
    const node = this.node;
    const code = node.code ?? def.fragment.replace(/\r\n?/g, '\n');
    const custom = node.customParams ?? [];
    this.codePanel.render({
      code,
      modified: node.code !== undefined && codeDiffers(node.code, def.fragment),
      reference: shaderReference(this.nodeDef as ShaderGenerator),
      params: {
        params: custom,
        builtIn: def.params,
        onAdd: (label) => {
          const taken = new Set([...def.params, ...custom].map((p) => p.key));
          this.setCustomParams([
            ...custom,
            {
              key: customParamKey(label, taken),
              label,
              type: 'float',
              min: 0,
              max: 1,
              default: 0.5,
              group: '',
            },
          ]);
        },
        onChange: (params) => this.renameAndSetCustomParams(custom, params),
      },
      onChange: (text) => this.setNodeCode(text),
      onRevert: () => this.setNodeCode(null),
    });
  }

  /**
   * Edited custom parameters: a renamed parameter gets a uniform named after it; its value and
   * the code's references to the old uniform follow.
   */
  private renameAndSetCustomParams(
    before: readonly CustomParamSpec[],
    after: readonly CustomParamSpec[],
  ): void {
    const def = this.generator;
    if (def.kind !== 'shader') return;
    let code = this.node.code;
    const params = { ...this.node.params };
    let changed = false;
    const taken = new Set([...def.params.map((p) => p.key), ...after.map((p) => p.key)]);
    const renamed = after.map((p, i) => {
      const old = before[i];
      if (!old || old.key !== p.key || old.label === p.label) return p;
      taken.delete(p.key);
      const key = customParamKey(p.label, taken);
      taken.add(key);
      if (key === p.key) return p;
      changed = true;
      const pattern = new RegExp(`\\bu_${p.key}\\b`, 'g');
      code = (code ?? def.fragment).replace(pattern, `u_${key}`);
      if (p.key in params) {
        params[key] = params[p.key]!;
        delete params[p.key];
      }
      return { ...p, key };
    });
    if (changed) {
      const node: GraphNode = { ...this.node, params };
      const withCode =
        code !== undefined && codeDiffers(code, def.fragment) ? { ...node, code } : node;
      this.commit({
        ...this.state,
        nodes: this.state.nodes.map((n) => (n.id === node.id ? withCode : n)),
      });
    }
    this.setCustomParams(renamed);
  }

  /**
   * Parameters created in the Code view: validated, values completed with their defaults,
   * then the panels rebuilt (new sliders, new uniforms in the reference).
   */
  private setCustomParams(specs: readonly CustomParamSpec[]): void {
    const def = this.generator;
    if (def.kind !== 'shader') return;
    const custom = sanitizeCustomParams(specs, new Set(def.params.map((p) => p.key)));
    const node = { ...this.node, customParams: custom };
    if (!custom.length) delete (node as { customParams?: unknown }).customParams;
    const params = sanitizeValues(effectiveGenerator(def, node).params, this.node.params);
    this.commit({
      ...this.state,
      nodes: this.state.nodes.map((n) => (n.id === node.id ? { ...node, params } : n)),
    });
    this.renderPanels();
    this.renderCode();
  }

  /** Edited GLSL of the selected node (null or the generator's code = back to the generator). */
  private setNodeCode(code: string | null): void {
    const def = this.generator;
    if (def.kind !== 'shader') return;
    const next = code !== null && codeDiffers(code, def.fragment) ? code : undefined;
    if (next === this.node.code) return;
    const node: GraphNode = { ...this.node, code: next };
    if (next === undefined) delete (node as { code?: string }).code;
    this.commit({
      ...this.state,
      nodes: this.state.nodes.map((n) => (n.id === node.id ? node : n)),
    });
    if (code === null) this.renderCode();
    else this.codePanel.setModified(next !== undefined);
  }

  // ---- Preset galleries ---------------------------------------------------------------------

  /** The selected node as `preset` would make it (generator settings, or Post Process look). */
  private presetNode(kind: 'params' | 'look' | 'ramp', preset: Preset): GraphNode {
    const node = this.node;
    const def = this.generator;
    if (kind === 'ramp')
      return {
        ...node,
        ramp: preset.ramp ?? node.ramp,
        post: { ...node.post, colorMode: COLOR_MODE.gradient },
      };
    if (kind === 'params') {
      const defs = effectiveGenerator(def, node).params;
      const params = sanitizeValues(defs, { ...defaultValues(defs), ...preset.values });
      return { ...node, params };
    }
    const look = { ...defaultValues(SCOPED_POST_PARAMS), ...preset.values };
    return { ...node, post: sanitizeValues(POST_PARAMS, { ...node.post, ...look }, node.post) };
  }

  /** Pointer over a gallery tile: the node shows the preset until the pointer leaves. */
  private previewPreset(kind: 'params' | 'look' | 'ramp', preset: Preset | null): void {
    this.hoverPreview = preset ? this.presetNode(kind, preset) : null;
  }

  /** The node as drawn this frame: the hovered preset replaces it while previewed. */
  private liveNode(node: GraphNode): GraphNode {
    const p = this.hoverPreview;
    return p && p.id === node.id && p.generator === node.generator ? p : node;
  }

  /** Thumbnail of the selected node with `preset` applied (cached, rendered in the background). */
  private presetThumbnail(
    kind: 'params' | 'look' | 'ramp',
    preset: Preset,
  ): Promise<string | null> {
    if (LITE) return Promise.resolve(null);
    const node = this.presetNode(kind, preset);
    const upstream = evaluationOrder(this.state, node.id)
      .filter((n) => n.id !== node.id)
      .map((n) => [n.generator, n.params, n.post, n.ramp, n.postEnabled, n.code]);
    const key = JSON.stringify([
      node.generator,
      node.params,
      node.post,
      node.ramp,
      node.postEnabled,
      node.code,
      node.customParams,
      upstream,
      this.state.links,
      this.state.seed,
      this.state.aspect,
    ]);
    const cached = this.galleryThumbs.get(key);
    if (cached) return Promise.resolve(cached);
    return new Promise((done) => {
      this.galleryQueue.push({ key, node, done });
      this.galleryTimer ??= setTimeout(() => this.renderGalleryThumb(), 0);
    });
  }

  private renderGalleryThumb(): void {
    this.galleryTimer = undefined;
    const job = this.galleryQueue.shift();
    if (!job) {
      this.galleryCapture?.dispose();
      this.galleryCapture = null;
      return;
    }
    // Requests for a node that is no longer shown are dropped.
    if (job.node.id !== this.node.id) job.done(null);
    else {
      try {
        const [w, hgt] = imageDims(112, this.state.aspect);
        if (this.galleryCapture?.width !== w || this.galleryCapture.height !== hgt) {
          this.galleryCapture?.dispose();
          this.galleryCapture = this.renderer.createCapture(w, hgt);
        }
        const url = captureToDataUrl(
          this.galleryCapture,
          this.chainFor(job.node.id, this.time, false, job.node),
        );
        if (this.galleryThumbs.size > 400) this.galleryThumbs.clear();
        this.galleryThumbs.set(job.key, url);
        job.done(url);
      } catch (e) {
        if (e instanceof ProgramPending) {
          // Custom code compiling: come back to it later.
          this.galleryQueue.push(job);
          this.galleryTimer = setTimeout(() => this.renderGalleryThumb(), 200);
          return;
        }
        job.done(null);
      }
    }
    this.galleryTimer = setTimeout(() => this.renderGalleryThumb(), 16);
  }

  private setRamp(ramp: GradientValue): void {
    this.commit(withNode(this.state, this.node.id, { ramp }));
  }

  /** Pushes current state into every panel (after undo, file load, presets…). */
  private syncPanels(): void {
    this.paramPanel.setValues(this.params);
    this.updateInputParams();
    this.colorPanel.setValues(this.colorValues());
    this.postPanel.setValues(this.post);
    this.outputPanel.setValues(this.post);
    this.animationPanel.setValues(this.post);
    this.generalPanel.setValues(this.globalValues());
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

  // ---- User presets -------------------------------------------------------------------------

  private readonly userPresets = new UserPresets();

  private userPresetButton(def: GeneratorDefinition): HTMLElement {
    return userPresetMenu({
      list: () => this.userPresets.list(def.id),
      save: () => void this.saveUserPreset(def),
      apply: (preset) => void this.applyPreset(preset),
      rename: (preset) => void this.renameUserPreset(def, preset),
      remove: (preset) => void this.removeUserPreset(def, preset),
    });
  }

  /** Saves the selected node's settings (params, look, ramp) as a user preset. */
  private async saveUserPreset(def: GeneratorDefinition): Promise<void> {
    const node = this.node;
    const name = await promptDialog({
      title: `Save a ${def.name} preset`,
      label: 'Name',
      value: `My ${def.name} ${this.userPresets.list(def.id).length + 1}`,
      confirmLabel: 'Save',
    });
    if (!name) return;
    const exists = this.userPresets.list(def.id).some((p) => p.name === name);
    if (
      exists &&
      !(await confirmDialog({
        title: `Replace "${name}"?`,
        message: 'A preset with this name already exists for this generator.',
        confirmLabel: 'Replace',
      }))
    )
      return;
    this.userPresets.save(def.id, {
      name,
      values: node.params,
      post: node.post,
      ramp: node.ramp,
    });
    this.renderPanels();
    toast(`Saved preset "${name}"`);
  }

  private async renameUserPreset(def: GeneratorDefinition, preset: Preset): Promise<void> {
    const name = await promptDialog({
      title: 'Rename preset',
      label: 'Name',
      value: preset.name,
      confirmLabel: 'Rename',
    });
    if (!name) return;
    this.userPresets.rename(def.id, preset.name, name);
    this.renderPanels();
  }

  private async removeUserPreset(def: GeneratorDefinition, preset: Preset): Promise<void> {
    const ok = await confirmDialog({
      title: `Delete "${preset.name}"?`,
      message: 'The preset is removed from your library (this cannot be undone).',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    this.userPresets.remove(def.id, preset.name);
    this.renderPanels();
  }

  // ---- Generator presets --------------------------------------------------------------------

  private baseline: PresetBaseline | null = null;

  private baselineFor(node: GraphNode): PresetBaseline {
    const key = `${node.id}:${node.generator}`;
    if (this.baseline?.key === key) return this.baseline;
    const def = getGenerator(node.generator) ?? GENERATORS[0]!;
    return {
      key,
      params: sanitizeValues(def.params, defaultValues(def.params)),
      look: pickScoped(postDefaults(def)),
      ramp: node.ramp,
    };
  }

  /**
   * A generator preset sets the generator settings only (every parameter starts again from the
   * defaults, then the preset's values): the Post Process is never touched, just as look
   * presets never touch the generator. A preset that also carries a look (`post` / `ramp`)
   * offers to apply it from a toast.
   */
  private async applyPreset(preset: Preset): Promise<void> {
    const node = this.node;
    const def = this.generator;
    const baseline = this.baselineFor(node);
    if (!deepEqual(sanitizeValues(def.params, node.params), baseline.params)) {
      const ok = await confirmDialog({
        title: `Apply preset "${preset.name}"?`,
        message:
          'The preset replaces every generator setting of this node: your current changes ' +
          'are lost (Ctrl+Z still brings them back). The Post Process is kept.',
        confirmLabel: 'Apply preset',
        dontAskKey: 'preset',
      });
      if (!ok || node.id !== this.node.id || def !== this.generator) return;
    }
    const before = this.node.params;
    const defs = this.nodeDef.params;
    const params = sanitizeValues(defs, { ...defaultValues(defs), ...preset.values });
    this.commit(withNode(this.state, this.node.id, { params }));
    this.baseline = { ...this.baselineFor(this.node), params };
    this.syncPanels();
    this.maybeResetSimulation(before, params);
    if (preset.post !== undefined || preset.ramp !== undefined) {
      const id = this.node.id;
      const what = preset.post !== undefined ? 'look' : 'colors';
      toast(`"${preset.name}" comes with its own ${what}`, 'info', 6000, {
        label: `Apply ${what}`,
        run: () => {
          if (this.node.id === id && this.generator === def) void this.applyPresetLook(preset);
        },
      });
    }
  }

  /**
   * Applies the Post Process look a generator preset carries: modules reset to the generator
   * defaults, then the preset's `post`; its `ramp` replaces the color ramp.
   */
  private async applyPresetLook(preset: Preset): Promise<void> {
    const node = this.node;
    const def = this.generator;
    const baseline = this.baselineFor(node);
    if (!deepEqual(pickScoped(node.post), baseline.look) || !deepEqual(node.ramp, baseline.ramp)) {
      const ok = await confirmDialog({
        title: `Apply the look of "${preset.name}"?`,
        message: 'Every Post Process module and the color ramp are replaced by the preset look.',
        confirmLabel: 'Apply look',
        dontAskKey: 'postPreset',
      });
      if (!ok || node.id !== this.node.id || def !== this.generator) return;
    }
    const current = this.node;
    const base = postDefaults(def);
    const output = Object.fromEntries(OUTPUT_PARAMS.map((d) => [d.key, current.post[d.key]]));
    const post = sanitizeValues(
      POST_PARAMS,
      { ...base, ...output, ...upgradeLegacyPost(preset.post ?? {}) },
      base,
    );
    const ramp = preset.ramp ?? current.ramp;
    this.commit(withNode(this.state, current.id, { post, ramp }));
    this.baseline = { ...this.baselineFor(this.node), look: pickScoped(post), ramp };
    this.syncPanels();
  }

  // ---- Simulation ---------------------------------------------------------------------------

  private get simulationDef(): SimulationGenerator | null {
    const def = this.generator;
    return def.kind === 'simulation' ? def : null;
  }

  private cacheOf(id: string): NodeCache {
    let cache = this.nodeCaches.get(id);
    if (!cache) {
      cache = {
        targets: this.renderer.createTargets(),
        signature: '',
        version: 0,
        simFrames: 0,
        simVersion: 0,
      };
      this.nodeCaches.set(id, cache);
    }
    return cache;
  }

  private resetSimulation(node: GraphNode = this.node): void {
    const def = getGenerator(node.generator);
    if (def?.kind !== 'simulation') return;
    try {
      this.renderer.simulationFor(def, node.id).sim.reset(node.params, this.state.seed);
      const cache = this.cacheOf(node.id);
      cache.simFrames = 0;
      cache.simVersion++;
      if (node.id === this.node.id) {
        this.clearKeyframes();
        this.captureKeyframe(def);
      }
    } catch (e) {
      this.showRenderError(node.id, e);
    }
  }

  /** The node's live simulation; a newly created one is initialized from the node's params. */
  private liveSim(node: GraphNode, def: SimulationGenerator): Simulation {
    const { sim, created } = this.renderer.simulationFor(def, node.id);
    if (created) {
      sim.reset(node.params, this.state.seed);
      const cache = this.cacheOf(node.id);
      cache.simFrames = 0;
      cache.simVersion++;
    }
    return sim;
  }

  /**
   * Restarts every simulation node. Painted canvases (`seedless`) keep their content unless
   * `includeSeedless` (workspace change) or they are the selected node (explicit restart).
   */
  private resetAllSimulations(includeSeedless = false): void {
    for (const n of this.state.nodes) {
      const def = getGenerator(n.generator);
      const keep = def?.kind === 'simulation' && def.seedless === true && !includeSeedless;
      if (!keep || n.id === this.node.id) this.resetSimulation(n);
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
    this.liveSim(this.node, def).setPointer(pointer);
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

  private get simFrames(): number {
    return this.nodeCaches.get(this.node.id)?.simFrames ?? 0;
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
    this.resetAllSimulations();
  }

  private seek(time: number): void {
    this.time = clamp(time, 0, this.loopDuration);
  }

  private stepFrame(direction: 1 | -1): void {
    this.playing = false;
    this.updateToolbar();
    const def = this.generator;
    if (def.kind === 'simulation') {
      if (direction > 0) this.stepSimulation(this.node, def);
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
  /** Export window choices remembered for the session. */
  private lastMapFlips: [boolean, boolean] = [false, false];
  private lastHeight16 = false;
  private readonly refreshFilmstrip = debounce(() => this.renderFilmstrip(), 450);

  /** Renders evenly spaced frames of the loop into the timeline, a few per tick. */
  private renderFilmstrip(): void {
    const token = ++this.filmToken;
    const def = this.generator;
    const nodeId = this.node.id;
    if (!this.layout.isVisible('timeline') || def.kind !== 'shader' || !def.animated) {
      this.disposeFilmCapture();
      return;
    }
    const count = this.timeline.filmstripSlots();
    const urls: (string | null)[] = new Array<string | null>(count).fill(null);
    const duration = this.loopDuration;
    let i = 0;
    const next = () => {
      if (token !== this.filmToken || nodeId !== this.node.id || def !== this.generator) return;
      try {
        this.filmCapture ??= this.renderer.createCapture(FILM_SIZE, FILM_SIZE);
        // One frame per tick keeps the UI responsive on slow GPUs (readPixels is synchronous).
        const time = ((i + 0.5) / count) * duration;
        urls[i] = captureToDataUrl(this.filmCapture, this.chainFor(nodeId, time, false));
        i++;
        this.timeline.setFilmstrip(urls);
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
    const sim = this.liveSim(this.node, def);
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
      const url = captureToDataUrl(capture, this.chainFor(this.node.id, this.time, true));
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
    this.liveSim(this.node, def).restore?.(key.snapshot);
    const cache = this.cacheOf(this.node.id);
    cache.simFrames = key.frame;
    cache.simVersion++;
    // Later keyframes stay available (scrubbing back and forth is non-destructive); they are
    // dropped only when the simulation runs again from here (`stepSimulation`).
    this.rewoundTo = index;
    this.playing = false;
    this.updateToolbar();
  }

  private clearKeyframes(): void {
    for (const k of this.keyframes) k.snapshot.dispose();
    this.keyframes = [];
    this.keyInterval = KEYFRAME_INTERVAL;
    this.rewoundTo = null;
    this.timeline.setKeyframes([]);
  }

  // ---- Toolbar actions ----------------------------------------------------------------------

  private setSeed(seed: number): void {
    this.commit({ ...this.state, seed: clamp(Math.round(seed), 0, MAX_SEED) });
    this.generalPanel.setValues(this.globalValues());
    this.resetAllSimulations();
  }

  private setViewTiles(n: number): void {
    this.viewTiles = n;
    this.viewport.setViewTiles(n);
    this.updateToolbar();
  }

  private restoreSnapshot(snapshot: EditorState): void {
    const before = this.node;
    this.commit(snapshot, { record: false });
    const after = this.node;
    if (before.id === after.id && before.generator === after.generator) {
      this.syncPanels();
      this.maybeResetSimulation(before.params, after.params);
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
      systemName: this.systemName,
      viewTiles: this.viewTiles,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    });
  }

  // ---- Requests -----------------------------------------------------------------------------

  /** The frame request of `node` (inputs are resolved by the caller). */
  private requestFor(node: GraphNode, time: number, forExport: boolean): FrameRequest {
    const base = getGenerator(node.generator) ?? GENERATORS[0]!;
    // Custom parameters are uniforms of the node's own program (code path).
    const def = effectiveGenerator(base, node);
    const code =
      node.code ??
      (base.kind === 'shader' && node.customParams?.length ? base.fragment : undefined);
    const overrides = forExport ? def.exportOverrides : undefined;
    return {
      ...(code !== undefined ? { code } : {}),
      generator: def,
      params: overrides ? { ...node.params, ...overrides } : node.params,
      post: node.post,
      ramp: node.ramp,
      time: node.frozenAt ?? time,
      seed: this.state.seed,
      key: node.id,
      postEnabled: node.postEnabled,
    };
  }

  /**
   * `id` and everything it depends on, as a capture chain (offscreen renders, exports);
   * `replace` stands in for the node of the same id (preset previews).
   */
  private chainFor(id: string, time: number, forExport: boolean, replace?: GraphNode): ChainStep[] {
    const order = evaluationOrder(this.state, id).map((n) =>
      replace && n.id === replace.id ? replace : n,
    );
    const index = new Map(order.map((n, i) => [n.id, i]));
    return order.map((node) => {
      const links: Record<string, ChainInput> = {};
      for (const [input, link] of Object.entries(inputLinks(this.state.links, node.id))) {
        const step = index.get(link.from);
        if (step !== undefined) links[input] = { step, output: link.output };
      }
      return { req: this.requestFor(node, time, forExport), links };
    });
  }

  private fileBase(): string {
    return `${this.generator.id}-s${this.state.seed}`;
  }

  /** Pixel blocks per side when the Pixelate module asks for a native-resolution export. */
  private nativePixelSize(): number | null {
    const p = this.post;
    return this.node.postEnabled && p.pixelateOn === true && p.pixelExport === true
      ? getNumber(p, 'pixelate')
      : null;
  }

  // ---- Import / export ----------------------------------------------------------------------

  /** Whether the selected node changes over time (itself or something it depends on). */
  private get selectionAnimated(): boolean {
    return evaluationOrder(this.state, this.node.id).some((n) => {
      const def = getGenerator(n.generator);
      return def !== undefined && (def.animated || def.kind === 'simulation');
    });
  }

  /** Export window: every export kind, then that kind's own settings / download. */
  private async openExport(): Promise<void> {
    const def = this.generator;
    const [w, hgt] = imageDims(this.nativePixelSize() ?? this.state.resolution, this.state.aspect);
    const [ew, eh] = imageDims(this.state.resolution, this.state.aspect);
    const count = this.state.nodes.length;
    const selected: ExportChoice[] = [
      {
        kind: 'png',
        icon: 'texture',
        title: 'Image (PNG)',
        description: `${w} × ${hgt} px`,
      },
      {
        kind: 'maps',
        icon: 'output',
        title: 'Texture maps',
        description: 'Color, normal, height',
      },
      {
        kind: 'flipbook',
        icon: 'film',
        title: 'Flipbook',
        description: 'Looping sprite sheet',
        ...(this.selectionAnimated ? {} : { disabled: 'Nothing animated' }),
      },
    ];
    const graph: ExportChoice[] = [
      {
        kind: 'nodes',
        icon: 'nodes',
        title: 'All nodes (ZIP)',
        description: `${count} PNG${count > 1 ? 's' : ''} · ${ew} × ${eh} px`,
      },
      {
        kind: 'json',
        icon: 'save',
        title: 'Document (.json)',
        description: 'Reopen it later',
      },
      {
        kind: 'share',
        icon: 'link',
        title: 'Share link',
        description: 'Copied to the clipboard',
      },
    ];
    const kind = await askExport(`${this.systemName} · selected: ${def.name}`, [
      { label: 'Selected node', choices: selected },
      { label: 'Whole graph', choices: graph },
    ]);
    if (kind === 'png') await this.exportPng();
    else if (kind === 'maps') await this.exportMaps();
    else if (kind === 'flipbook') await this.exportFlipbook();
    else if (kind === 'nodes') await this.exportAllNodes();
    else if (kind === 'json') this.saveFile();
    else if (kind === 'share') this.share();
  }

  /** Every node as a PNG (export resolution), in one ZIP. */
  private async exportAllNodes(): Promise<void> {
    const [w, hgt] = imageDims(this.state.resolution, this.state.aspect);
    try {
      const used = new Map<string, number>();
      const entries: { name: string; data: Uint8Array }[] = [];
      for (const node of this.state.nodes) {
        const def = getGenerator(node.generator);
        if (!def) continue;
        const n = (used.get(def.id) ?? 0) + 1;
        used.set(def.id, n);
        const blob = await renderPng(
          this.renderer,
          this.chainFor(node.id, this.time, true),
          w,
          hgt,
        );
        entries.push({
          name: `${def.id}${n > 1 ? `-${n}` : ''}.png`,
          data: new Uint8Array(await blob.arrayBuffer()),
        });
      }
      const base = this.systemName.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'system';
      downloadBlob(
        new Blob([createZip(entries)], { type: 'application/zip' }),
        `${base}-nodes-${w}x${hgt}.zip`,
      );
      toast(`Exported ${entries.length} node${entries.length > 1 ? 's' : ''} (${w}×${hgt})`);
    } catch (e) {
      toast(`Export failed: ${errorMessage(e)}`, 'error');
    }
  }

  private async exportPng(): Promise<void> {
    const size = this.nativePixelSize() ?? this.state.resolution;
    try {
      const [w, h] = imageDims(size, this.state.aspect);
      const blob = await renderPng(
        this.renderer,
        this.chainFor(this.node.id, this.time, true),
        w,
        h,
      );
      downloadBlob(blob, `${this.fileBase()}-${w}x${h}.png`);
      toast(`Exported ${w}×${h} PNG`);
    } catch (e) {
      toast(`Export failed: ${errorMessage(e)}`, 'error');
    }
  }

  /** Capture chain of node `id` rendering `map` with the export window's options. */
  private mapChain(id: string, map: MapKind, o: ExportMapsOptions): ChainStep[] {
    const chain = this.chainFor(id, this.time, true);
    const last = chain[chain.length - 1]!;
    chain[chain.length - 1] = {
      ...last,
      req: {
        ...last.req,
        post: {
          ...last.req.post,
          output: MAP_OUTPUT[map],
          alphaMode: o.alphaMode,
          heightSource: o.heightSource,
          normalStrength: o.normalStrength,
          normalFlipY: o.normalFlipY,
        },
        // Normal and height maps are computed by the post pass.
        postEnabled: map === 'color' ? last.req.postEnabled : true,
      },
    };
    return chain;
  }

  /** Export window: choose and tune the color / normal / height maps, preview, export. */
  private async exportMaps(): Promise<void> {
    const id = this.node.id;
    const post = this.post;
    const aspect = this.state.aspect;
    const [pw, ph] = imageDims(160, aspect);
    let capture: Capture | null = null;
    const choice = await askExportMaps(
      {
        maps: { color: true, normal: true, height: true },
        alphaMode: getNumber(post, 'alphaMode'),
        heightSource: getNumber(post, 'heightSource'),
        normalStrength: getNumber(post, 'normalStrength', 2),
        normalFlipY: post.normalFlipY === true,
        // Flowmaps: start from the last export's convention.
        flipRed: this.lastMapFlips[0],
        flipGreen: this.lastMapFlips[1],
        height16: this.lastHeight16,
        resolution: this.state.resolution,
        prefix: this.fileBase(),
        zip: true,
      },
      {
        resolutions: RESOLUTIONS,
        dims: (r) => imageDims(r, aspect),
        preview: (map, o) => {
          capture ??= this.renderer.createCapture(pw, ph);
          try {
            const edit = map === 'color' ? flipChannels(o.flipRed, o.flipGreen) : undefined;
            return captureToDataUrl(capture, this.mapChain(id, map, o), edit);
          } catch (e) {
            console.warn('Map preview failed', e);
            return '';
          }
        },
      },
    );
    (capture as Capture | null)?.dispose();
    if (!choice) return;
    this.lastMapFlips = [choice.flipRed, choice.flipGreen];
    this.lastHeight16 = choice.height16;
    const [w, h] = imageDims(choice.resolution, aspect);
    const kinds = (['color', 'normal', 'height'] as const).filter((k) => choice.maps[k]);
    try {
      const files: { name: string; blob: Blob }[] = [];
      for (const kind of kinds) {
        const chain = this.mapChain(id, kind, choice);
        const blob =
          kind === 'height' && choice.height16
            ? await renderPng16(this.renderer, chain, w, h)
            : await renderPng(
                this.renderer,
                chain,
                w,
                h,
                kind === 'color' ? flipChannels(choice.flipRed, choice.flipGreen) : undefined,
              );
        files.push({ name: `${choice.prefix}-${kind}.png`, blob });
      }
      if (choice.zip) {
        const entries = await Promise.all(
          files.map(async (f) => ({
            name: f.name,
            data: new Uint8Array(await f.blob.arrayBuffer()),
          })),
        );
        downloadBlob(
          new Blob([createZip(entries)], { type: 'application/zip' }),
          `${choice.prefix}-maps-${w}x${h}.zip`,
        );
      } else {
        for (const f of files) downloadBlob(f.blob, f.name);
      }
      toast(`Exported ${kinds.join(', ')} (${w}×${h})`);
    } catch (e) {
      toast(`Export failed: ${errorMessage(e)}`, 'error');
    }
  }

  /** Simulation nodes `id` depends on (they advance together during a flipbook). */
  private simulationsOf(id: string): { node: GraphNode; def: SimulationGenerator }[] {
    const out: { node: GraphNode; def: SimulationGenerator }[] = [];
    for (const node of evaluationOrder(this.state, id)) {
      const def = getGenerator(node.generator);
      if (def?.kind === 'simulation') out.push({ node, def });
    }
    return out;
  }

  private async exportFlipbook(): Promise<void> {
    const def = this.generator;
    const id = this.node.id;
    const sims = this.simulationsOf(id);
    const choice = await askFlipbookOptions(
      def.kind === 'simulation',
      this.renderer.gpu.caps.maxTextureSize,
      { duration: this.loopDuration },
      (s) => imageDims(s, this.state.aspect),
    );
    const native = this.nativePixelSize();
    if (!choice) return;
    const opts = native ? { ...choice, frameSize: native } : choice;
    const count = opts.columns * opts.rows;
    const stepAll = () => {
      for (const { node, def: simDef } of sims)
        if (node.frozenAt === null) this.liveSim(node, simDef).step(node.params);
    };
    try {
      if (sims.length > 0) {
        if (opts.restart) for (const { node } of sims) this.resetSimulation(node);
        const warmup = Math.round(opts.startTime * SIM_FRAMES_PER_SECOND);
        for (let k = 0; k < warmup; k++) {
          stepAll();
          // Yield now and then: long warm-ups must not freeze the page.
          if (k % 30 === 29) await new Promise((r) => setTimeout(r, 0));
        }
      }
      const frame = imageDims(opts.frameSize, this.state.aspect);
      const blob = await renderFlipbook(this.renderer, opts, frame, (i) => {
        if (def.kind === 'simulation') {
          if (i > 0) for (let k = 0; k < opts.stepsBetweenFrames; k++) stepAll();
          return this.chainFor(id, this.time, true);
        }
        // Frames cover [0, duration): with a seamless loop of the same duration, the sheet
        // loops perfectly.
        return this.chainFor(id, opts.startTime + (i / count) * opts.duration, true);
      });
      downloadBlob(blob, `${this.fileBase()}-flipbook-${opts.columns}x${opts.rows}.png`);
      toast(`Exported ${count}-frame flipbook`);
    } catch (e) {
      toast(`Export failed: ${errorMessage(e)}`, 'error');
    }
    for (const { node } of sims) this.cacheOf(node.id).simVersion++;
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
    downloadBlob(blob, `${this.fileBase()}.fxd.json`);
  }

  private async loadFile(): Promise<void> {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const doc = parseDocument(JSON.parse(await file.text()) as unknown, getGenerator);
      // An opened file becomes a new system of the library (the current one is kept).
      this.saveSystem(true);
      const name = file.name.replace(/(\.fxd)?\.json$/i, '') || 'Opened system';
      const entry = this.library.create(name, doc);
      this.systemId = entry.id;
      this.library.setCurrent(entry.id);
      this.loadState(applyDocument(doc));
      toast(`Opened ${file.name} as "${this.systemName}"`);
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

    this.stepSimulations();
    const animated = this.state.nodes.some((n) => {
      const def = getGenerator(n.generator);
      return def?.kind === 'shader' && def.animated;
    });
    if (this.playing && animated && !this.scrubbing) this.advanceTime(dt * this.speed);
    this.draw();

    this.updateTimeline();
    this.updateFps(dt);
    requestAnimationFrame(this.frame);
  };

  /** Advances every simulation node (painting on a paused selected one steps it too). */
  private stepSimulations(): void {
    const steps = this.playing ? this.consumeSteps() : 0;
    for (const node of this.state.nodes) {
      const def = getGenerator(node.generator);
      if (def?.kind !== 'simulation' || this.failed.has(node.id) || node.frozenAt !== null)
        continue;
      const painting = this.pointerActive && !this.playing && node.id === this.node.id;
      const n = painting ? 1 : steps;
      for (let i = 0; i < n; i++) this.stepSimulation(node, def);
    }
  }

  private consumeSteps(): number {
    this.simAccum = Math.min(this.simAccum + this.speed, 4);
    const n = Math.floor(this.simAccum);
    this.simAccum -= n;
    return n;
  }

  private advanceTime(dt: number): void {
    const d = this.loopDuration;
    let t = this.time + dt;
    // Loop off: time keeps running (useful to explore beyond the timeline range).
    if (t >= d && this.loopPlayback) t %= d;
    this.time = t;
  }

  private stepSimulation(node: GraphNode, def: SimulationGenerator): void {
    const selected = node.id === this.node.id;
    if (selected && this.rewoundTo !== null) {
      // Running again from a rewound keyframe: later ones belong to the abandoned future.
      for (const k of this.keyframes.splice(this.rewoundTo + 1)) k.snapshot.dispose();
      this.timeline.setKeyframes(this.keyframes);
      this.rewoundTo = null;
    }
    try {
      const sim = this.liveSim(node, def);
      const cache = this.cacheOf(node.id);
      sim.step(node.params);
      cache.simVersion++;
      const frames = ++cache.simFrames;
      if (!selected) return;
      if (frames % this.keyInterval === 0) this.captureKeyframe(def);
      if (frames === SIM_THUMBNAIL_FRAME) this.captureSimulationThumbnail(def);
    } catch (e) {
      this.showRenderError(node.id, e);
    }
  }

  /** Signature of what a node's image depends on (it re-renders when this changes). */
  private signature(node: GraphNode, size: number, cache: NodeCache): string {
    const def = getGenerator(node.generator);
    const upstream = Object.entries(inputLinks(this.state.links, node.id))
      .map(
        ([input, l]) =>
          `${input}=${l.from}.${l.output ?? ''}@${this.nodeCaches.get(l.from)?.version ?? 0}`,
      )
      .join(',');
    const time = def?.kind === 'shader' && def.animated ? (node.frozenAt ?? this.time) : 0;
    const sim = def?.kind === 'simulation' ? cache.simVersion : 0;
    return JSON.stringify([
      node.generator,
      node.params,
      node.post,
      node.ramp,
      node.postEnabled,
      node.code,
      this.assetVersion,
      this.state.seed,
      size,
      time,
      sim,
      upstream,
    ]);
  }

  /** Re-renders the nodes whose inputs changed, then draws every card on the canvas. */
  private draw(): void {
    const rects = this.viewport.nodeRects();
    // Adaptive preview: while a value is being dragged on a slow frame rate, render the
    // selected node at half size to keep the UI responsive; full size comes back as soon as
    // editing pauses.
    const full = Math.min(this.state.resolution, MAX_PREVIEW_SIZE);
    const interacting = performance.now() - this.lastChange < ADAPTIVE_IDLE_MS;
    this.degraded = interacting && this.frameMs > ADAPTIVE_SLOW_MS && full > 256;
    const selectedSize = this.degraded ? full / 2 : full;

    for (const stateNode of fullEvaluationOrder(this.state)) {
      const node = this.liveNode(stateNode);
      if (this.failed.has(node.id)) continue;
      const cache = this.cacheOf(node.id);
      const rect = rects.get(node.id);
      const size =
        node.id === this.state.selectedId
          ? selectedSize
          : clamp(
              nextPow2((rect?.width ?? MIN_NODE_SIZE) * this.viewTiles),
              MIN_NODE_SIZE,
              Math.min(full, MAX_UNSELECTED_SIZE),
            );
      const signature = this.signature(node, size, cache);
      if (signature === cache.signature) continue;
      const inputs: Record<string, RenderTarget> = {};
      for (const [input, link] of Object.entries(inputLinks(this.state.links, node.id))) {
        const out = this.nodeCaches.get(link.from)?.targets.outputFor(link.output);
        if (out) inputs[input] = out;
      }
      const [width, height] = imageDims(size, this.state.aspect);
      try {
        this.renderer.renderNode(
          { ...this.requestFor(node, this.time, false), inputs },
          cache.targets,
          width,
          height,
        );
        cache.signature = signature;
        cache.version++;
      } catch (e) {
        // User code still compiling in the background: keep the last image, retry next frame.
        if (!(e instanceof ProgramPending)) this.showRenderError(node.id, e);
      }
    }

    const items: DisplayItem[] = [];
    const magnified = this.viewport.magnified;
    // Back to front (the rects come in stacking order): the card in front draws last.
    for (const [id, rect] of rects) {
      const node = nodeById(this.state, id);
      if (!node) continue;
      const texture = this.nodeCaches.get(node.id)?.targets.output?.texture;
      if (!rect || !texture) continue;
      const selected = node.id === this.state.selectedId;
      items.push({
        texture,
        ...rect,
        tiles: this.viewTiles,
        nearest: selected && magnified,
        dim: 0,
      });
    }
    const { width, height } = this.viewport.canvasSize();
    this.renderer.display(items, width, height);
    this.detectValueTypes();
    this.viewport.setRenderSize(imageDims(selectedSize, this.state.aspect)[0]);
  }

  /**
   * Tells grayscale from color node outputs (pin and link colors) by reading back a tiny
   * resampling of the image. A node is checked again when its image changed, at most twice a
   * second, and a couple of nodes per frame.
   */
  private detectValueTypes(): void {
    const now = performance.now();
    let budget = 2;
    let changed = false;
    for (const node of this.state.nodes) {
      if (budget === 0) break;
      const cache = this.nodeCaches.get(node.id);
      const texture = cache?.targets.output?.texture;
      if (!cache || !texture || cache.version === 0) continue;
      const last = this.typeChecks.get(node.id);
      if (last && (last.version === cache.version || now - last.at < 500)) continue;
      budget--;
      this.typeChecks.set(node.id, { version: cache.version, at: now });
      const type: NodeValueType = this.renderer.isGrayscale(texture) ? 'gray' : 'color';
      if (this.valueTypes.get(node.id) !== type) {
        this.valueTypes.set(node.id, type);
        changed = true;
      }
    }
    if (changed) this.syncGraph();
  }

  private showRenderError(nodeId: string, e: unknown): void {
    const message = errorMessage(e);
    if (this.failed.get(nodeId) === message) return;
    this.failed.set(nodeId, message);
    console.error(e);
    if (nodeId === this.node.id) this.viewport.setError(message);
    this.syncGraph();
  }

  /** Snapshot of the running simulation for its tile in the generator browser. */
  private captureSimulationThumbnail(def: SimulationGenerator): void {
    if (LITE) return;
    const capture = this.renderer.createCapture(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    try {
      const url = captureToDataUrl(capture, this.requestFor(this.node, this.time, true));
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
    const [pw, ph] = imageDims(
      Math.min(this.state.resolution, MAX_PREVIEW_SIZE),
      this.state.aspect,
    );
    const [ew, eh] = imageDims(this.state.resolution, this.state.aspect);
    const count = this.state.nodes.length;
    const links = this.state.links.length;
    this.statusLeft.textContent =
      `${this.fps} FPS · preview ${pw}×${ph}${this.degraded ? ' (reduced)' : ''} · ` +
      `${count} node${count > 1 ? 's' : ''} · ${links} link${links === 1 ? '' : 's'}`;
    this.statusMid.textContent = `${this.systemName} › ${this.generator.name} · export ${ew}×${eh} · seed ${this.state.seed}`;
    this.statusRight.textContent = `${caps.floatTargets ? 'float32' : caps.halfFloatTargets ? 'float16' : '8-bit'} targets · ${caps.renderer}`;
  }

  // ---- Browser thumbnails -------------------------------------------------------------------

  /** Browser thumbnail of `def` with its defaults, or with `preset` applied. */
  private thumbnailRequest(def: GeneratorDefinition, preset?: Preset): FrameRequest {
    const params = sanitizeValues(def.params, { ...defaultValues(def.params), ...preset?.values });
    // Presets set shapes, not colors: thumbnails use the generator's own Post Process
    // defaults and the default ramp, whatever look a preset may also carry.
    const post = postDefaults(def);
    const req = {
      generator: def,
      params,
      post,
      ramp: DEFAULT_RAMP,
      time: 1.3,
      seed: 7,
      key: 'thumbnail',
    };
    const overrides = def.exportOverrides;
    return overrides ? { ...req, params: { ...req.params, ...overrides } } : req;
  }

  /** Hover preview in the browser: thumbnails of every preset of `id` (rendered once). */
  private readonly presetThumbs = new Map<string, string[]>();

  private previewPresets(id: string): void {
    const def = getGenerator(id);
    if (LITE || !def || def.kind !== 'shader' || isOperator(def) || !def.presets?.length) return;
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
  /**
   * Thumbnails are rendered lazily, one per timer tick, only for tiles that scroll into view
   * (simulations get theirs from the live preview instead).
   */
  private requestThumbnail(id: string): void {
    const def = getGenerator(id);
    if (
      LITE ||
      !def ||
      def.kind !== 'shader' ||
      isOperator(def) ||
      this.thumbDone.has(id) ||
      this.thumbQueue.includes(id)
    )
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
      const mod = e.ctrlKey || e.metaKey;
      // Delete works unless text is being typed (a focused dropdown or slider doesn't count).
      if (e.defaultPrevented) return;
      if (!mod && (e.key === 'Delete' || e.key === 'Backspace') && !isTypingText()) {
        if (e.target instanceof HTMLSelectElement) e.preventDefault();
        // A clicked link goes first, otherwise the selected nodes.
        const link = this.viewport.selectedLink();
        if (link) this.commit(withoutLink(this.state, link.to, link.input));
        else this.deleteNodes(this.viewport.selectedIds());
        return;
      }
      if (isEditingText()) return;
      if (e.code === 'Space' && !mod) {
        e.preventDefault();
        this.togglePlay();
      } else if (!mod && (e.key === 't' || e.key === 'T')) {
        this.layout.toggle('timeline');
      } else if (!mod && (e.key === ',' || e.key === '.')) {
        this.stepFrame(e.key === '.' ? 1 : -1);
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.duplicateNode();
      } else if (mod && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
        this.copyNodes();
      } else if (mod && e.key.toLowerCase() === 'v' && this.clipboard) {
        e.preventDefault();
        this.pasteNodes();
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

  /** Ctrl+D: copy of the selected node (settings included), next to it. */
  /** Ctrl+C: the selected nodes and the links between them (in-app clipboard). */
  private copyNodes(): void {
    const ids = new Set(this.viewport.selectedIds());
    const nodes = this.state.nodes.filter((n) => ids.has(n.id));
    if (!nodes.length) return;
    this.clipboard = {
      nodes,
      links: this.state.links.filter((l) => ids.has(l.from) && ids.has(l.to)),
    };
    toast(`Copied ${nodes.length} node${nodes.length > 1 ? 's' : ''}`);
  }

  /**
   * Ctrl+V: copies of the clipboard nodes (settings and inner links kept) under the pointer,
   * or offset from the originals; they become the selection.
   */
  private pasteNodes(): void {
    const clip = this.clipboard;
    if (!clip?.nodes.length) return;
    const minX = Math.min(...clip.nodes.map((n) => n.x));
    const minY = Math.min(...clip.nodes.map((n) => n.y));
    const at = this.viewport.pointerWorld();
    const dx = at ? Math.round((at[0] - minX) / 24) * 24 : 48;
    const dy = at ? Math.round((at[1] - minY) / 24) * 24 : 48;
    const ids = new Map<string, string>();
    let nodes = [...this.state.nodes];
    for (const n of clip.nodes) {
      const id = newNodeId(nodes);
      ids.set(n.id, id);
      nodes = [...nodes, { ...n, id, x: n.x + dx, y: n.y + dy, frozenAt: null }];
    }
    const links = clip.links.map((l) => ({ ...l, from: ids.get(l.from)!, to: ids.get(l.to)! }));
    const pasted = [...ids.values()];
    const primary = pasted[pasted.length - 1]!;
    this.commit({ ...this.state, nodes, links: [...this.state.links, ...links], selectedId: primary });
    this.viewport.selectMany(pasted, primary);
  }

  private clipboard: { nodes: readonly GraphNode[]; links: readonly GraphLink[] } | null = null;

  private duplicateNode(): void {
    const source = this.node;
    const [x, y] = this.viewport.placementNear(source.id);
    const copy: GraphNode = { ...source, id: newNodeId(this.state.nodes), x, y };
    this.commit(withAddedNode(this.state, copy));
  }
}
