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
import { inputsOf, outputsOf, type NodeChannel } from '../engine/nodes';
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
import {
  ADDABLE_GENERATORS,
  DEFAULT_GENERATOR_ID,
  GENERATORS,
  getGenerator,
} from '../generators/registry';
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
import { askVideoOptions } from '../ui/VideoDialog';
import { Preview3D } from '../ui/Preview3D';
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
import {
  NODE_WIDTH,
  Viewport,
  type GraphContextMenu,
  type GraphViewNode,
  type LinkDrop,
} from '../ui/Viewport';
import { openQuickAdd } from '../ui/QuickAddMenu';
import { openContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { openCommunity } from '../ui/CommunityDialog';
import { Community } from './community';
import { mostUsedNodes, recordNodeUsage } from './nodeUsage';
import { debounce } from '../util/debounce';
import { fnv1a } from '../util/hash';
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
import {
  canRecordVideo,
  captureToDataUrl,
  flipChannels,
  recordVideo,
  renderFlipbook,
  renderGif,
  renderPng,
  renderPng16,
} from './exporter';
import { Cloud } from './cloud';
import { History } from './history';
import {
  contentHash,
  Library,
  type PreviewFraming,
  type PublishedLink,
  type PublishState,
} from './library';
import {
  composePreview,
  DEFAULT_FRAMING,
  openPreviewStudio,
  type PreviewResult,
  type PreviewSource,
} from '../ui/PreviewStudio';
import type { CurrentSystem } from '../ui/CommunityDialog';
import { clearHash, loadSession, readHashDocument, saveSession, shareUrl } from './persistence';
import {
  codeDiffers,
  createNode,
  customParamKey,
  effectiveGenerator,
  editedBaseParams,
  sanitizeBaseParamEdits,
  type BaseParamEdit,
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
import { SIM_THUMBNAIL, ThumbnailCache } from './thumbnails';
import { UserPresets } from './userPresets';

const THUMBNAIL_SIZE = 64;
/** Seed offset between two cells of a variations atlas (coprime with MAX_SEED + 1). */
const VARIATION_SEED_STEP = 7919;
/** Browser thumbnails compiling in the background at once. */
const THUMBNAIL_COMPILES = 3;
/**
 * `?e2e`: no background thumbnails (browser tiles, preset galleries). Software-rendered test
 * browsers would spend most of their time on them.
 */
const RUN_OPTIONS = new URLSearchParams(window.location.search);
const LITE = RUN_OPTIONS.has('e2e');
const PAUSED_TEST = LITE && RUN_OPTIONS.has('paused');
/** Color ramp presets as gallery presets (only their ramp matters). */
const RAMP_PRESETS: readonly Preset[] = GRADIENT_PRESETS.map((p) => ({
  name: p.name,
  values: {},
  ramp: p.value,
}));
/** User preset scopes shared by every node (generator presets use the generator id). */
const USER_LOOK_SCOPE = '@look';
const USER_COLOR_SCOPE = '@color';

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
  private playing = !PAUSED_TEST;
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
  /** Nodes whose image has transparent pixels (their alpha pin is always shown). */
  private readonly transparent = new Set<string>();
  /** Channel shown in a node's preview while one of its channel pins is hovered. */
  private pinPreview: { readonly id: string; readonly channel: NodeChannel } | null = null;
  private readonly typeChecks = new Map<
    string,
    { readonly version: number; readonly at: number }
  >();
  private readonly thumbnails = new ThumbnailCache();
  /** Node and generator the panels currently show (rebuilt when either changes). */
  private shownKey = '';

  private lastFrame = 0;
  /** A video export is running (it steps the simulations itself). */
  private recording = false;
  /** Some node of the graph is still compiling (background work waits). */
  private graphPending = false;
  /** What the canvas shows (redrawn only when it changes). */
  private displayKey = '';
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
    const workspace = dockPanel('workspace', 'Workspace', 'tune', 'aside');
    const preview3d = dockPanel('preview3d', '3D Preview', 'sun', 'section', () =>
      this.layout.set('preview3d', false),
    );
    preview3d.body.append(this.preview3d.element);
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
    workspace.body.append(generalEl);
    const outputEl = h('div');
    const animationEl = h('div');
    this.codeBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-small code-toggle',
        title: 'Show the GLSL of this node; editing it makes the node custom',
        onclick: () => {
          writeStorage(`ptm.codeView.${this.codeViewKey}`, this.codeOpen ? '0' : '1');
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
        h('p', { class: 'page-intro', text: 'Output and animation settings for this node.' }),
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
        { id: 'workspace', title: 'Workspace', icon: 'tune', element: workspace.panel },
        { id: 'preview3d', title: '3D Preview', icon: 'sun', element: preview3d.panel },
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
      onShuffleSeed: (id) => this.shuffleNodeSeed(id),
      onToggleCollapse: (id) => this.toggleCollapse(id),
      onLinkDrop: (drop) => this.quickAdd(drop),
      onPinPreview: (id, channel) => {
        this.pinPreview = id !== null && channel !== null ? { id, channel } : null;
      },
      onInsertReroute: (link, world) => this.insertReroute(link, world),
      onContextMenu: (menu) => this.graphMenu(menu),
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
        openCommunity: () => this.openCommunity(),
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

    this.state = this.withSingleOutput(this.initialState());
    this.renderer.gpu.workspaceAspect = this.state.aspect;
    this.viewport.setAspect(this.state.aspect);
    this.syncGraph();
    this.activateNode();
    this.bindGlobalEvents();
    requestAnimationFrame(this.frame);
    this.generatorList.onVisible = (id) => this.requestThumbnail(id);
    this.generatorList.onHover = (id) => this.previewPresets(id);
    void this.thumbnails.loaded.then(() => {
      // Stored images show at once (even stale ones, replaced when rendered again).
      for (const [id, { url }] of this.thumbnails.entries())
        this.generatorList.setThumbnail(id, url);
      this.thumbnailsLoaded = true;
      for (const id of this.generatorList.visibleIds()) this.requestThumbnail(id);
    });
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

  /** The first connected Output node: once there is one, it is what the system exports. */
  private get outputNode(): GraphNode | null {
    return this.connectedOutput(this.state);
  }

  private connectedOutput(state: EditorState): GraphNode | null {
    return (
      state.nodes.find(
        (n) =>
          getGenerator(n.generator)?.role === 'output' && state.links.some((l) => l.to === n.id),
      ) ?? null
    );
  }

  /** What exports and the library thumbnail render: the connected Output, else the selection. */
  private get exportNode(): GraphNode {
    return this.outputNode ?? this.node;
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

  /** A new graph: the default node connected to an Output node. */
  private blankState(): EditorState {
    const def = getGenerator(DEFAULT_GENERATOR_ID) ?? GENERATORS[0]!;
    const output = getGenerator('output')!;
    return {
      nodes: [
        createNode(def, 'n1', 0, 0),
        createNode(output, 'n2', Viewport.snap(NODE_WIDTH + 120), 0),
      ],
      links: [{ from: 'n1', to: 'n2', input: 'image' }],
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

  /** Small image of the exported node (Output, else the selection), for the library card. */
  private systemThumbnail(size = 112): string | null {
    const [w, hgt] = imageDims(size, this.state.aspect);
    let capture: Capture | null = null;
    try {
      capture = this.renderer.createCapture(w, hgt);
      return captureToDataUrl(capture, this.chainFor(this.exportNode.id, this.time, true));
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
      publishState: (id) => this.publishStateOf(id),
      community: {
        publish: (id) => {
          this.openCommunity({ publish: true }, id);
        },
        view: (id) => {
          const link = this.library.get(id)?.published;
          if (link) this.openCommunity({ view: link.id });
        },
        edit: (id) => {
          const link = this.library.get(id)?.published;
          if (link) this.openCommunity({ edit: link.id });
        },
        unlink: async (id) => {
          const entry = this.library.get(id);
          if (!entry?.published) return;
          const ok = await confirmDialog({
            title: `Make "${entry.name}" local only?`,
            message:
              'It stays online in the community, but this system is not linked to it any more ' +
              '(its changes can no longer be published as updates).',
            confirmLabel: 'Unlink',
          });
          if (ok) {
            this.library.setPublished(id, null);
            this.updateToolbar();
          }
        },
      },
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
          message: this.cloud.user
            ? 'The system will be deleted from your synced library.'
            : 'The system will be deleted from your local library.',
          irreversible: true,
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

  private readonly community = new Community();

  /**
   * Publication state of library system `id`: local, published as is, or edited since. The
   * open system is judged on its live graph (the autosave may not have run yet).
   */
  private publishStateOf(id: string): PublishState {
    const link = this.library.get(id)?.published;
    if (!link) return 'local';
    if (id !== this.systemId) return this.library.publishState(id);
    return contentHash(this.document()) === link.hash ? 'published' : 'modified';
  }

  private currentSystem(id: string, state: EditorState): CurrentSystem {
    const entry = this.library.get(id);
    return {
      name: entry?.name ?? this.systemName,
      state: this.publishStateOf(id),
      link: entry?.published ?? null,
      animated: this.animatedExport(state),
    };
  }

  /**
   * Frames of the exported node for the community preview: 16 over its loop when it moves
   * (simulations step between frames, like a flipbook), else one.
   */
  private async previewSource(state: EditorState, renderer: Renderer): Promise<PreviewSource> {
    const id = (this.connectedOutput(state) ?? selectedNode(state)).id;
    const animated = this.animatedExport(state);
    const count = animated ? 16 : 1;
    const duration = this.exportLoopDuration(state);
    const [w, hgt] = imageDims(384, state.aspect);
    const sims = this.simulationsOf(id, state);
    const steps = Math.max(1, Math.round((duration * SIM_FRAMES_PER_SECOND) / count));
    const capture = renderer.createCapture(w, hgt);
    const frames: HTMLCanvasElement[] = [];
    try {
      for (let i = 0; i < count; i++) {
        if (i > 0)
          for (let k = 0; k < steps; k++)
            for (const { node, def } of sims)
              if (node.frozenAt === null)
                renderer.simulationFor(def, node.id).sim.step(node.params);
        const chain = this.chainFor(id, (i / count) * duration, true, undefined, state);
        const deadline = performance.now() + 10_000;
        let pixels: ReturnType<Capture['render']>;
        for (;;) {
          try {
            pixels = capture.render(chain);
            break;
          } catch (e) {
            if (!(e instanceof ProgramPending) || performance.now() > deadline) throw e;
            await new Promise((resolve) => setTimeout(resolve, 16));
          }
        }
        const canvas = h('canvas', { width: w, height: hgt });
        canvas.getContext('2d')!.putImageData(new ImageData(pixels, w, hgt), 0, 0);
        frames.push(canvas);
        // Yield now and then: the page stays responsive.
        if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      capture.dispose();
      if (renderer === this.renderer)
        for (const { node } of sims) this.cacheOf(node.id).simVersion++;
    }
    return { frames, animated, frameMs: (duration * 1000) / count };
  }

  /** Images of a community version: framed like `framing`, or chosen in the preview editor. */
  private async communityPreview(
    interactive: boolean,
    framing: PreviewFraming | undefined,
    state: EditorState,
    detached: boolean,
  ): Promise<PreviewResult | null> {
    const source = detached
      ? await this.detachedPreviewSource(state)
      : await this.previewSource(state, this.renderer);
    return interactive
      ? openPreviewStudio(source, framing ?? DEFAULT_FRAMING)
      : composePreview(source, framing ?? DEFAULT_FRAMING);
  }

  private async detachedPreviewSource(state: EditorState): Promise<PreviewSource> {
    const renderer = new Renderer(h('canvas'));
    try {
      renderer.gpu.workspaceAspect = state.aspect;
      const id = (this.connectedOutput(state) ?? selectedNode(state)).id;
      const urls = this.chainFor(id, 0, true, undefined, state).flatMap(({ req }) =>
        req.generator.params.flatMap((def) => {
          const value = req.params[def.key];
          return def.type === 'image' && typeof value === 'string' ? [value] : [];
        }),
      );
      await renderer.images.preload(urls);
      return await this.previewSource(state, renderer);
    } finally {
      renderer.dispose();
      renderer.gpu.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }

  /** The open system's document as stored (what is published and hashed). */
  private storedDocument(id: string): unknown {
    if (id === this.systemId) this.saveSystem(true);
    const document = this.library.load(id);
    if (!document) throw new Error('This system is no longer in your library');
    if (/"data:image\//i.test(JSON.stringify(document)))
      throw new Error(
        'Replace embedded images using “Use image URL…” on each Image node before publishing.',
      );
    return document;
  }

  private mediaOf(preview: PreviewResult, animated: boolean) {
    return {
      animated,
      thumb: preview.thumb,
      preview: animated ? preview.preview : null,
      previewFrames: animated ? preview.previewFrames : 0,
    };
  }

  private linkSystem(
    systemId: string,
    id: string,
    version: number | null,
    doc: unknown,
    framing: PreviewFraming,
  ): void {
    const link: PublishedLink = { id, version, hash: contentHash(doc), framing };
    // One library system per community system.
    for (const e of this.library.list())
      if (e.id !== systemId && e.published?.id === id) this.library.setPublished(e.id, null);
    this.library.setPublished(systemId, link);
    this.updateToolbar();
  }

  /** Library systems linked to a deleted community system become local. */
  private forgetPublication(communityId: string): void {
    for (const e of this.library.list())
      if (e.published?.id === communityId) this.library.setPublished(e.id, null);
    this.updateToolbar();
  }

  /** Community window: systems shared by everyone; publishing sends the open system. */
  private openCommunity(
    opts: { publish?: boolean; view?: string; edit?: string } = {},
    systemId = this.systemId,
  ): void {
    this.saveSystem(true);
    let savedState: EditorState | undefined;
    let savedHash: string | undefined;
    if (systemId !== this.systemId) {
      try {
        const doc = this.library.load(systemId);
        savedState = applyDocument(parseDocument(doc, getGenerator));
        savedHash = contentHash(doc);
      } catch (e) {
        toast(`Cannot preview this system: ${errorMessage(e)}`, 'error');
        return;
      }
    }
    const state = () => savedState ?? this.state;
    const document = () => {
      const doc = this.storedDocument(systemId);
      if (savedHash !== undefined && savedHash !== contentHash(doc))
        throw new Error('This system changed. Reopen publication to refresh the preview.');
      return doc;
    };
    const community = this.community;
    openCommunity(
      {
        community,
        signedIn: () => this.cloud.user !== null,
        signIn: () => this.account?.signIn(),
        current: () => this.currentSystem(systemId, state()),
        preview: (interactive, framing) =>
          this.communityPreview(interactive, framing, state(), savedState !== undefined),
        publishCurrent: async (fields, preview, animated) => {
          const doc = document();
          const r = await community.publish(fields, doc, this.mediaOf(preview, animated));
          this.linkSystem(systemId, r.id, r.version, doc, preview.framing);
          return r.id;
        },
        publishUpdate: async (preview, id, animated) => {
          const target = id ?? this.library.get(systemId)?.published?.id;
          if (!target) throw new Error('This system is not published');
          const doc = document();
          const version = await community.update(target, {}, doc, this.mediaOf(preview, animated));
          this.linkSystem(systemId, target, version, doc, preview.framing);
          return version;
        },
        canAnimate: (item) => {
          try {
            return this.animatedExport(applyDocument(parseDocument(item.document, getGenerator)));
          } catch {
            return item.animated;
          }
        },
        editPublishedPreview: async (item, framing) => {
          const state = applyDocument(parseDocument(item.document, getGenerator));
          const previous = this.library.findPublished(item.id)?.published?.framing;
          return openPreviewStudio(
            await this.detachedPreviewSource(state),
            framing ?? previous ?? DEFAULT_FRAMING,
          );
        },
        editPublication: async (item, fields, animated, editedPreview) => {
          if (editedPreview) {
            await community.update(
              item.id,
              fields,
              undefined,
              this.mediaOf(editedPreview, animated),
            );
            const entry = this.library.findPublished(item.id);
            if (entry?.published && entry.published.version === item.version)
              this.library.setPublished(entry.id, {
                ...entry.published,
                framing: editedPreview.framing,
              });
          } else if (animated === item.animated) {
            await community.update(item.id, fields);
          } else if (!animated) {
            await community.update(item.id, fields, undefined, {
              animated: false,
              preview: null,
              previewFrames: 0,
            });
          } else {
            const state = applyDocument(parseDocument(item.document, getGenerator));
            const framing = this.library.findPublished(item.id)?.published?.framing;
            const preview = composePreview(
              await this.detachedPreviewSource(state),
              framing ?? DEFAULT_FRAMING,
            );
            await community.update(item.id, fields, undefined, {
              animated: true,
              preview: preview.preview,
              previewFrames: preview.previewFrames,
            });
          }
        },
        forget: (id) => this.forgetPublication(id),
        copyToLibrary: (system) => {
          try {
            const doc = parseDocument(system.document, getGenerator);
            this.saveSystem(true);
            const entry = this.library.create(
              system.name,
              documentFromState(applyDocument(doc), getGenerator),
            );
            this.switchSystem(entry.id, false);
          } catch (e) {
            toast(`Cannot open this system: ${errorMessage(e)}`, 'error');
          }
        },
      },
      { ...opts, libraryPublish: savedState !== undefined },
    );
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
    this.transparent.clear();
    this.typeChecks.clear();
    this.commit(this.withSingleOutput(state), { record: false });
    this.shownKey = '';
    this.activateNode();
    this.resetAllSimulations(true);
    this.viewport.fit();
    this.updateToolbar();
  }

  private withSingleOutput(state: EditorState): EditorState {
    const outputs = state.nodes.filter((node) => getGenerator(node.generator)?.role === 'output');
    if (outputs.length > 1) {
      const keep =
        outputs.find((node) => state.links.some((link) => link.to === node.id)) ?? outputs[0]!;
      for (const node of outputs) if (node !== keep) state = withoutNode(state, node.id);
      return state;
    }
    if (outputs.length) return state;
    const rightmost = state.nodes.reduce<GraphNode | undefined>(
      (right, node) => (!right || node.x > right.x ? node : right),
      undefined,
    );
    const output = createNode(
      getGenerator('output')!,
      newNodeId(state.nodes),
      Viewport.snap((rightmost?.x ?? 0) + NODE_WIDTH + 120),
      rightmost?.y ?? 0,
    );
    return { ...state, nodes: [...state.nodes, output] };
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
    if (prev.nodes !== next.nodes || prev.seed !== next.seed) {
      for (const node of next.nodes) {
        const old = nodeById(prev, node.id);
        const def = getGenerator(node.generator);
        if (
          old?.generator === node.generator &&
          def?.kind === 'simulation' &&
          !def.seedless &&
          (old.seed ?? prev.seed) !== (node.seed ?? next.seed)
        )
          this.resetSimulation(node);
      }
    }
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
        seeded: n.seed !== undefined,
        canShuffleSeed: this.nodeUsesSeed(n, def),
        inputs: inputsOf(def),
        outputs: outputsOf(def),
        failed: this.failed.has(n.id),
        collapsed: n.collapsed === true,
        transparent: this.transparent.has(n.id),
        role: def.role ?? null,
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
    for (const id of this.transparent) if (!ids.has(id)) this.transparent.delete(id);
    for (const id of this.typeChecks.keys()) if (!ids.has(id)) this.typeChecks.delete(id);
    const sims = new Set(
      this.state.nodes
        .filter((n) => getGenerator(n.generator)?.kind === 'simulation')
        .map((n) => n.id),
    );
    this.renderer.retainSimulations(sims);
  }

  /** Greys out settings based on whether their corresponding input is connected. */
  private updateInputParams(): void {
    const linked = inputLinks(this.state.links, this.node.id);
    const off = new Map<string, string>();
    for (const input of inputsOf(this.generator)) {
      if (linked[input.key]) {
        for (const key of input.fallbackParams ?? [])
          off.set(key, `Disconnect ${input.label} to use this value`);
      } else {
        for (const key of input.params ?? [])
          off.set(key, `Connect ${input.label} to use this setting`);
      }
    }
    this.paramPanel.setDisabled(off);
  }

  /** Selects node `id` ('' = none: the Details panel shows a hint). */
  private selectNode(id: string): void {
    if (id === this.state.selectedId || (id && !nodeById(this.state, id))) return;
    // Selection is not an undoable edit.
    this.commit({ ...this.state, selectedId: id }, { record: false });
  }

  /** Right-click menu of the graph: node, link or background actions. */
  private graphMenu(menu: GraphContextMenu): void {
    const { target, world, client } = menu;
    const many = (n: number) => (n > 1 ? `${n} nodes` : 'node');
    const paste: ContextMenuEntry = {
      label: 'Paste',
      icon: 'download',
      shortcut: 'Ctrl+V',
      disabled: !this.clipboard,
      run: () => this.pasteNodes(world),
    };
    let entries: ContextMenuEntry[];
    if (target.kind === 'nodes') {
      const ids = target.ids;
      const nodes = ids.map((id) => nodeById(this.state, id)).filter((n) => n !== undefined);
      const clicked = nodeById(this.state, target.clickedId);
      const postTargets = nodes.filter((node) => getGenerator(node.generator)?.role !== 'reroute');
      const all = ids.length >= this.state.nodes.length;
      const collapsed = nodes.every((n) => n.collapsed === true);
      const bypassed = nodes.every((n) => !n.postEnabled);
      const frozen = nodes.every((n) => n.frozenAt !== null);
      const patchAll = (patch: (n: GraphNode) => Partial<GraphNode>) =>
        this.commit(nodes.reduce((s, n) => withNode(s, n.id, patch(n)), this.state));
      entries = [
        { label: 'Cut', shortcut: 'Ctrl+X', disabled: all, run: () => this.cutNodes(ids) },
        { label: 'Copy', icon: 'layout', shortcut: 'Ctrl+C', run: () => this.copyNodes(ids) },
        paste,
        {
          label: 'Duplicate',
          shortcut: 'Ctrl+D',
          run: () => {
            this.copyNodes(ids, true);
            this.pasteNodes([world[0] + 48, world[1] + 48]);
          },
        },
        {
          label: `Delete ${many(ids.length)}`,
          icon: 'close',
          shortcut: 'Del',
          disabled: all,
          run: () => this.deleteNodes(ids),
        },
        null,
        {
          label: collapsed ? 'Expand' : 'Collapse',
          icon: 'expand',
          run: () => patchAll(() => ({ collapsed: !collapsed })),
        },
        {
          label: bypassed ? 'Enable Post Process' : 'Bypass Post Process',
          icon: 'fx',
          run: () => patchAll(() => ({ postEnabled: bypassed })),
        },
        {
          label: 'Copy Post Process',
          icon: 'fx',
          disabled: !clicked || getGenerator(clicked.generator)?.role === 'reroute',
          run: () => {
            if (!clicked) return;
            const post = Object.fromEntries(
              POST_PROCESS_PARAMS.map(({ key, default: fallback }) => [
                key,
                clicked.post[key] ?? fallback,
              ]),
            );
            this.postClipboard = { post, ramp: clicked.ramp, postEnabled: clicked.postEnabled };
            toast('Post Process copied');
          },
        },
        {
          label: 'Paste Post Process',
          disabled: !this.postClipboard || postTargets.length === 0,
          run: () => {
            const clip = this.postClipboard;
            if (!clip) return;
            this.commit(
              postTargets.reduce(
                (state, node) =>
                  withNode(state, node.id, {
                    ...clip,
                    post: { ...node.post, ...clip.post },
                  }),
                this.state,
              ),
            );
            this.syncPanels();
            toast(
              postTargets.length === 1
                ? 'Post Process pasted'
                : `Post Process pasted to ${postTargets.length} nodes`,
            );
          },
        },
        {
          label: frozen ? 'Unfreeze' : 'Freeze frame',
          icon: 'snowflake',
          run: () => patchAll(() => ({ frozenAt: frozen ? null : this.time })),
        },
        {
          label: 'Disconnect',
          disabled: !this.state.links.some((l) => ids.includes(l.from) || ids.includes(l.to)),
          run: () =>
            this.commit({
              ...this.state,
              links: this.state.links.filter((l) => !ids.includes(l.from) && !ids.includes(l.to)),
            }),
        },
        null,
        {
          label: 'Frame selection',
          icon: 'viewport',
          shortcut: 'Shift+F',
          run: () => this.viewport.frameSelected(),
        },
        {
          label: 'Collapse into new system…',
          icon: 'library',
          run: () => void this.collapseIntoSystem(ids),
        },
      ];
    } else if (target.kind === 'link') {
      const { link } = target;
      entries = [
        {
          label: 'Add reroute',
          run: () => this.insertReroute(link, world),
        },
        {
          label: 'Delete link',
          icon: 'close',
          shortcut: 'Del',
          run: () => this.commit(withoutLink(this.state, link.to, link.input)),
        },
      ];
    } else {
      entries = [
        {
          label: 'Add node…',
          icon: 'zoomIn',
          run: () =>
            openQuickAdd({
              x: client[0],
              y: client[1],
              title: 'Add a node',
              suggestions: mostUsedNodes(ADDABLE_GENERATORS).map((d) => ({
                id: d.id,
                name: d.name,
                label: CATEGORY_LABELS[d.category],
              })),
              all: ADDABLE_GENERATORS.map((d) => ({
                id: d.id,
                name: d.name,
                label: CATEGORY_LABELS[d.category],
              })),
              onPick: (id) => this.addNode(id, [Viewport.snap(world[0]), Viewport.snap(world[1])]),
            }),
        },
        paste,
        null,
        {
          label: 'Fit all nodes',
          icon: 'fit',
          shortcut: 'F',
          run: () => this.viewport.fit(),
        },
      ];
    }
    openContextMenu(client[0], client[1], entries);
  }

  /**
   * Houdini's "Collapse into Subnet", as a library system: the nodes (and the links between
   * them) move to a new system, ending in an Output node; the current one keeps the rest.
   */
  private async collapseIntoSystem(ids: readonly string[]): Promise<void> {
    const set = new Set(ids);
    const picked = this.state.nodes.filter((n) => set.has(n.id));
    if (!picked.length) return;
    const name = await promptDialog({
      title: 'Collapse into new system',
      label: 'Name',
      value: `${this.systemName} part`,
      confirmLabel: 'Create',
    });
    if (!name) return;
    const links = this.state.links.filter((l) => set.has(l.from) && set.has(l.to));
    const minX = Math.min(...picked.map((n) => n.x));
    const minY = Math.min(...picked.map((n) => n.y));
    const nodes: GraphNode[] = picked.map((n) => ({ ...n, x: n.x - minX, y: n.y - minY }));
    const newLinks: GraphLink[] = [...links];
    // End in an Output node: fed by the selected node if it is a sink, else by the last sink.
    const isOutput = (n: GraphNode) => getGenerator(n.generator)?.role === 'output';
    if (!nodes.some(isOutput)) {
      const sinks = nodes.filter((n) => !isOutput(n) && !links.some((l) => l.from === n.id));
      const last = sinks.find((n) => n.id === this.state.selectedId) ?? sinks[sinks.length - 1];
      const outputDef = getGenerator('output');
      if (last && outputDef) {
        const id = newNodeId(nodes);
        const right = Math.max(...nodes.map((n) => n.x));
        nodes.push(createNode(outputDef, id, Viewport.snap(right + NODE_WIDTH + 120), last.y));
        newLinks.push({ from: last.id, to: id, input: 'image' });
      }
    }
    const selectedId = set.has(this.state.selectedId) ? this.state.selectedId : nodes[0]!.id;
    const doc = documentFromState(
      { ...this.state, nodes, links: newLinks, selectedId },
      getGenerator,
    );
    const folder = this.library.get(this.systemId)?.folder ?? null;
    const entry = this.library.create(name, doc, folder);
    // Cut from this system (the last node always stays).
    const moved = ids.length < this.state.nodes.length;
    if (moved) this.deleteNodes(ids);
    toast(
      moved
        ? `Moved ${picked.length} node${picked.length > 1 ? 's' : ''} to "${name}"`
        : `Copied the graph to "${name}"`,
      'info',
      6000,
      { label: 'Open', run: () => this.switchSystem(entry.id) },
    );
  }

  /** Adds a node running `generatorId`, at `at` (graph units) or next to the selected node. */
  private addNode(generatorId: string, at?: [number, number]): void {
    const def = getGenerator(generatorId);
    if (!def || def.role) return;
    const [x, y] = at ?? this.viewport.placementNear(this.state.selectedId);
    // New nodes start from the default look: one node's colors never leak into others.
    const node = createNode(def, newNodeId(this.state.nodes), x, y);
    recordNodeUsage(def.id);
    // A Custom Shader is written in code: show its Code view.
    this.commit(withAddedNode(this.state, node));
  }

  /**
   * A link was dropped on empty space: offer the most used nodes and a search, then create
   * the chosen node there, already connected (one undoable step).
   */
  private quickAdd(drop: LinkDrop): void {
    const fromOutput = drop.from !== undefined;
    // From an output the new node needs an input; from an input, any node with an output.
    const candidates = ADDABLE_GENERATORS.filter((d) => !fromOutput || inputsOf(d).length > 0);
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
    for (const id of ids) {
      // Deleting a Reroute keeps the link it was bending.
      const node = nodeById(next, id);
      if (node && getGenerator(node.generator)?.role === 'output') continue;
      const into = next.links.find((l) => l.to === id);
      if (node && into && getGenerator(node.generator)?.role === 'reroute') {
        const outs = next.links.filter((l) => l.from === id);
        next = withoutNode(next, id);
        for (const l of outs) {
          const bridged: GraphLink = into.output
            ? { from: into.from, to: l.to, input: l.input, output: into.output }
            : { from: into.from, to: l.to, input: l.input };
          next = withLink(next, bridged);
        }
      } else next = withoutNode(next, id);
    }
    this.commit(next);
  }

  /**
   * Several nodes selected: the Details panel shows the selection (they move together, Del
   * deletes them) instead of one node's settings.
   */
  private showMultiSelection(ids: readonly string[]): void {
    const el = this.multiInfo;
    el.hidden = ids.length === 1;
    if (el.hidden) return;
    if (ids.length === 0) {
      el.replaceChildren(
        h('h2', { text: 'No node selected' }),
        h('p', { class: 'description', text: 'Click a node to edit it.' }),
      );
      return;
    }
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

  /** Splits a link with a Reroute dot at `world` (double-click on the link). */
  private insertReroute(
    link: { readonly to: string; readonly input: string },
    world: readonly [number, number],
  ): void {
    const old = this.state.links.find((l) => l.to === link.to && l.input === link.input);
    const def = getGenerator('reroute');
    if (!old || !def) return;
    const id = newNodeId(this.state.nodes);
    const [x, y] = this.viewport.rerouteOrigin(world);
    const node: GraphNode = { ...createNode(def, id, x, y), postEnabled: false };
    const into: GraphLink = old.output
      ? { from: old.from, to: id, input: 'image', output: old.output }
      : { from: old.from, to: id, input: 'image' };
    this.commit({
      ...this.state,
      nodes: [...this.state.nodes, node],
      links: [
        ...this.state.links.filter((l) => l !== old),
        into,
        { from: id, to: old.to, input: old.input },
      ],
    });
  }

  /** Collapses / expands a node card (its image is hidden). */
  private toggleCollapse(id: string): void {
    const node = nodeById(this.state, id);
    if (node) this.commit(withNode(this.state, id, { collapsed: !node.collapsed }));
  }

  private toggleFreeze(id: string): void {
    const node = nodeById(this.state, id);
    if (!node) return;
    this.commit(withNode(this.state, id, { frozenAt: node.frozenAt === null ? this.time : null }));
  }

  private nodeUsesSeed(node: GraphNode, def: GeneratorDefinition): boolean {
    if (def.kind === 'simulation') return !def.seedless;
    const usesSeed = /\b(?:u_seed|hash\w*|latticeGradient|\w*Noise|cellPoint|voronoi\w*|fbm\w*)\b/;
    return (
      usesSeed.test(node.code ?? def.fragment) ||
      (def.codeParam !== undefined && usesSeed.test(String(node.params[def.codeParam] ?? ''))) ||
      def.passes?.some((pass) => usesSeed.test(pass.fragment)) === true
    );
  }

  private shuffleNodeSeed(id: string): void {
    const node = nodeById(this.state, id);
    const def = node && getGenerator(node.generator);
    if (!node || !def || !this.nodeUsesSeed(node, def)) return;
    let seed = randomSeed();
    if (seed === (node.seed ?? this.state.seed)) seed = (seed + 1) % (MAX_SEED + 1);
    this.commit(withNode(this.state, id, { seed }));
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
    if (this.generator.role === 'output') return;
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
    const applyRamp = (preset: Preset) => {
      if (!preset.ramp) return;
      this.commit(
        withNode(this.state, this.node.id, {
          ramp: preset.ramp,
          post: { ...this.post, colorMode: COLOR_MODE.gradient },
        }),
      );
      this.syncPanels();
    };
    const colorModeDef = POST_PROCESS_PARAMS.filter((d) => d.group === 'Color');
    const moduleDefs = POST_PROCESS_PARAMS.filter((d) => d.group !== 'Color');

    this.paramPanel.render({
      defs: this.nodeDef.params,
      levelsRange: def.id === 'op-level',
      values: this.params,
      gallery: {
        title: 'Presets',
        presets: def.presets ?? [],
        userPresets: this.userPresets.list(def.id),
        userActions: this.userPresetActions(def.id),
        extras: [
          this.userPresetButton(
            def.id,
            def.name,
            (node) => ({
              values: node.params,
              post: node.post,
              ramp: node.ramp,
            }),
            (preset) => void this.applyPreset(preset),
          ),
        ],
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
        userPresets: this.userPresets.list(USER_COLOR_SCOPE),
        userActions: this.userPresetActions(USER_COLOR_SCOPE),
        extras: [
          this.userPresetButton(
            USER_COLOR_SCOPE,
            'color',
            (node) => ({ values: {}, ramp: node.ramp }),
            (preset) => applyRamp(preset),
          ),
        ],
        onPick: (preset) => applyRamp(preset),
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
        userPresets: this.userPresets.list(USER_LOOK_SCOPE),
        userActions: this.userPresetActions(USER_LOOK_SCOPE),
        extras: [
          this.userPresetButton(
            USER_LOOK_SCOPE,
            'look',
            (node) => ({ values: {}, post: pickScoped(node.post) }),
            (preset) => void this.applyPostPreset(preset),
          ),
        ],
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

  private get codeViewKey(): string {
    return `${this.systemId}:${this.node.id}:${this.node.generator}`;
  }

  private get codeOpen(): boolean {
    const saved = readStorage(`ptm.codeView.${this.codeViewKey}`);
    return saved === null ? this.generator.id === 'custom-shader' : saved === '1';
  }

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
      nodeKey: this.codeViewKey,
      code,
      modified: node.code !== undefined && codeDiffers(node.code, def.fragment),
      reference: shaderReference(this.nodeDef as ShaderGenerator),
      params: {
        nodeKey: this.codeViewKey,
        params: custom,
        builtIn: editedBaseParams(def.params, node.baseParamEdits),
        onBaseChange: (key, edit) => this.setBaseParam(key, edit),
        onAdd: (label) => {
          const taken = new Set([...def.params, ...custom].map((p) => p.key));
          const key = customParamKey(label, taken);
          this.codePanel.expandParam(this.codeViewKey, key);
          this.setCustomParams([
            ...custom,
            {
              key,
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

  private setBaseParam(key: string, edit: BaseParamEdit | null): void {
    const def = this.generator;
    if (def.kind !== 'shader' || def.codeParam) return;
    const current = this.node;
    const previous = this.nodeDef.params.find((param) => param.key === key);
    const baseParamEdits = sanitizeBaseParamEdits(
      { ...current.baseParamEdits, [key]: edit },
      def.params,
    );
    const node = { ...current, baseParamEdits };
    const schema = effectiveGenerator(def, node).params;
    const updated = schema.find((param) => param.key === key);
    const values = { ...current.params };
    if (
      updated &&
      previous &&
      (previous.type !== updated.type ||
        (deepEqual(values[key], previous.default) && !deepEqual(previous.default, updated.default)))
    )
      values[key] = updated.default;
    const params = sanitizeValues(schema, values);
    this.commit(withNode(this.state, current.id, { baseParamEdits, params }));
    this.renderPanels();
    this.renderCode();
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
      node.baseParamEdits,
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

  /**
   * "My presets" menu of a gallery. `scope` is a generator id (whole node settings) or a
   * shared scope (Post Process looks, color ramps); `snapshot` picks what the preset keeps.
   */
  private userPresetButton(
    scope: string,
    what: string,
    snapshot: (node: GraphNode) => Omit<Preset, 'name'>,
    apply: (preset: Preset) => void,
  ): HTMLElement {
    return userPresetMenu({
      list: () => this.userPresets.list(scope),
      save: () => void this.saveUserPreset(scope, what, snapshot),
      apply,
      rename: (preset) => void this.renameUserPreset(scope, preset),
      remove: (preset) => void this.removeUserPreset(scope, preset),
    });
  }

  private userPresetActions(scope: string) {
    return {
      rename: (preset: Preset) => void this.renameUserPreset(scope, preset),
      remove: (preset: Preset) => void this.removeUserPreset(scope, preset),
    };
  }

  /** Saves part of the selected node's settings as a user preset of `scope`. */
  private async saveUserPreset(
    scope: string,
    what: string,
    snapshot: (node: GraphNode) => Omit<Preset, 'name'>,
  ): Promise<void> {
    const node = this.node;
    const name = await promptDialog({
      title: `Save a ${what} preset`,
      label: 'Name',
      value: `My ${what} ${this.userPresets.list(scope).length + 1}`,
      confirmLabel: 'Save',
    });
    if (!name) return;
    const exists = this.userPresets.list(scope).some((p) => p.name === name);
    if (
      exists &&
      !(await confirmDialog({
        title: `Replace "${name}"?`,
        message: 'A preset with this name already exists.',
        confirmLabel: 'Replace',
      }))
    )
      return;
    this.userPresets.save(scope, { name, ...snapshot(node) });
    this.renderPanels();
    toast(`Saved preset "${name}"`);
  }

  private async renameUserPreset(scope: string, preset: Preset): Promise<void> {
    const name = await promptDialog({
      title: 'Rename preset',
      label: 'Name',
      value: preset.name,
      confirmLabel: 'Rename',
    });
    if (!name) return;
    this.userPresets.rename(scope, preset.name, name);
    this.renderPanels();
  }

  private async removeUserPreset(scope: string, preset: Preset): Promise<void> {
    const ok = await confirmDialog({
      title: `Delete "${preset.name}"?`,
      message: 'The preset will be removed from your library.',
      irreversible: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    this.userPresets.remove(scope, preset.name);
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
      this.renderer
        .simulationFor(def, node.id)
        .sim.reset(node.params, node.seed ?? this.state.seed);
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
      sim.reset(node.params, node.seed ?? this.state.seed);
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
    const nodes = this.state.nodes.map((node) => {
      if (node.seed === undefined) return node;
      const { seed: _seed, ...inherited } = node;
      return inherited;
    });
    this.commit({ ...this.state, nodes, seed: clamp(Math.round(seed), 0, MAX_SEED) });
    this.generalPanel.setValues(this.globalValues());
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
      publishState: this.publishStateOf(this.systemId),
      viewTiles: this.viewTiles,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    });
  }

  // ---- Requests -----------------------------------------------------------------------------

  /** The frame request of `node` (inputs are resolved by the caller). */
  private requestFor(
    node: GraphNode,
    time: number,
    forExport: boolean,
    seed = this.state.seed,
  ): FrameRequest {
    const base = getGenerator(node.generator) ?? GENERATORS[0]!;
    // Custom parameters are uniforms of the node's own program (code path).
    const def = effectiveGenerator(base, node);
    const code =
      node.code ??
      (base.kind === 'shader' && (node.customParams?.length || node.baseParamEdits)
        ? base.fragment
        : undefined);
    const overrides = forExport ? def.exportOverrides : undefined;
    return {
      ...(code !== undefined ? { code } : {}),
      generator: def,
      params: overrides ? { ...node.params, ...overrides } : node.params,
      post: node.post,
      ramp: node.ramp,
      time: node.frozenAt ?? time,
      seed: node.seed ?? seed,
      key: node.id,
      postEnabled: node.postEnabled,
    };
  }

  /**
   * `id` and everything it depends on, as a capture chain (offscreen renders, exports);
   * `replace` stands in for the node of the same id (preset previews).
   */
  private chainFor(
    id: string,
    time: number,
    forExport: boolean,
    replace?: GraphNode,
    state = this.state,
  ): ChainStep[] {
    const order = evaluationOrder(state, id).map((n) =>
      replace && n.id === replace.id ? replace : n,
    );
    const index = new Map(order.map((n, i) => [n.id, i]));
    return order.map((node) => {
      const links: Record<string, ChainInput> = {};
      for (const [input, link] of Object.entries(inputLinks(state.links, node.id))) {
        const step = index.get(link.from);
        if (step !== undefined) links[input] = { step, output: link.output };
      }
      return { req: this.requestFor(node, time, forExport, state.seed), links };
    });
  }

  private fileBase(): string {
    const def = getGenerator(this.exportNode.generator) ?? this.generator;
    return `${def.id}-s${this.state.seed}`;
  }

  /** Pixel blocks per side when the Pixelate module asks for a native-resolution export. */
  private nativePixelSize(): number | null {
    const node = this.exportNode;
    const p = node.post;
    return node.postEnabled && p.pixelateOn === true && p.pixelExport === true
      ? getNumber(p, 'pixelate')
      : null;
  }

  // ---- Import / export ----------------------------------------------------------------------

  /** Whether the exported node changes over time (itself or something it depends on). */
  private get selectionAnimated(): boolean {
    return this.animatedExport(this.state);
  }

  private animatedExport(state: EditorState): boolean {
    const id = (this.connectedOutput(state) ?? selectedNode(state)).id;
    return evaluationOrder(state, id).some((n) => {
      const def = getGenerator(n.generator);
      return def !== undefined && (def.animated || def.kind === 'simulation');
    });
  }

  /** Export window: every export kind, then that kind's own settings / download. */
  private async openExport(): Promise<void> {
    const output = this.outputNode;
    const def = getGenerator(this.exportNode.generator) ?? this.generator;
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
      {
        kind: 'video',
        icon: 'play',
        title: 'Video / GIF',
        description: 'Loop as WebM or animated GIF',
        ...(this.selectionAnimated ? {} : { disabled: 'Nothing animated' }),
      },
      {
        kind: 'variations',
        icon: 'dice',
        title: 'Variations',
        description: 'One random seed per cell',
        ...(this.simulationsOf(this.exportNode.id).length > 0
          ? { disabled: 'Simulations vary by running them again' }
          : {}),
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
    const kind = await askExport(
      `${this.systemName} · ${output ? 'Output' : `selected: ${def.name}`}`,
      [
        { label: output ? 'Output' : 'Selected node', choices: selected },
        { label: 'Whole graph', choices: graph },
      ],
    );
    if (kind === 'png') await this.exportPng();
    else if (kind === 'maps') await this.exportMaps();
    else if (kind === 'flipbook') await this.exportFlipbook();
    else if (kind === 'variations') await this.exportVariations();
    else if (kind === 'video') await this.exportVideo();
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
        this.chainFor(this.exportNode.id, this.time, true),
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
    const id = this.exportNode.id;
    const post = this.exportNode.post;
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

  /**
   * Loop length offered for a flipbook: the exported node's or, through Output / Reroute
   * pass-throughs, the loop of the node feeding them.
   */
  private exportLoopDuration(state = this.state): number {
    let node = this.connectedOutput(state) ?? selectedNode(state);
    for (let i = 0; i < 32 && getGenerator(node.generator)?.role; i++) {
      const link = state.links.find((l) => l.to === node.id);
      const from = link ? nodeById(state, link.from) : undefined;
      if (!from) break;
      node = from;
    }
    return getNumber(node.post, 'loopDuration', 4);
  }

  /** Simulation nodes `id` depends on (they advance together during a flipbook). */
  private simulationsOf(
    id: string,
    state = this.state,
  ): { node: GraphNode; def: SimulationGenerator }[] {
    const out: { node: GraphNode; def: SimulationGenerator }[] = [];
    for (const node of evaluationOrder(state, id)) {
      const def = getGenerator(node.generator);
      if (def?.kind === 'simulation') out.push({ node, def });
    }
    return out;
  }

  private async exportFlipbook(): Promise<void> {
    const id = this.exportNode.id;
    const sims = this.simulationsOf(id);
    const simulated = sims.length > 0;
    const choice = await askFlipbookOptions(
      simulated ? 'simulation' : 'shader',
      this.renderer.gpu.caps.maxTextureSize,
      { duration: this.exportLoopDuration() },
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
        if (simulated) {
          if (i > 0) for (let k = 0; k < opts.stepsBetweenFrames; k++) stepAll();
          // Simulations advance by steps; animated nodes after them follow the clock.
          return this.chainFor(id, opts.startTime + (i / count) * opts.duration, true);
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

  /** The animation (repeated loop, or a simulation run) recorded as a video. */
  private async exportVideo(): Promise<void> {
    const id = this.exportNode.id;
    const sims = this.simulationsOf(id);
    const simulated = sims.length > 0;
    const opts = await askVideoOptions(simulated, canRecordVideo(), {
      duration: this.exportLoopDuration(),
    });
    if (!opts) return;
    const frames = Math.max(1, Math.round(opts.duration * opts.fps));
    const steps = Math.max(1, Math.round(SIM_FRAMES_PER_SECOND / opts.fps));
    const gif = opts.format === 'gif';
    toast(gif ? 'Rendering GIF…' : `Recording ${(opts.duration * opts.repeats).toFixed(1)} s…`);
    this.recording = true;
    try {
      const blob = await (gif ? renderGif : recordVideo)(
        this.renderer,
        imageDims(opts.size, this.state.aspect),
        frames * opts.repeats,
        opts.fps,
        (i) => {
          if (simulated && i > 0) {
            for (const { node, def } of sims)
              if (node.frozenAt === null)
                for (let k = 0; k < steps; k++) this.liveSim(node, def).step(node.params);
          }
          // Frames cover [0, duration): with a seamless loop of that duration, repeats join.
          return this.chainFor(id, ((i % frames) / frames) * opts.duration, true);
        },
      );
      const ext = gif ? 'gif' : blob.type.includes('mp4') ? 'mp4' : 'webm';
      downloadBlob(blob, `${this.fileBase()}.${ext}`);
      toast(gif ? 'Exported GIF' : 'Exported video');
    } catch (e) {
      toast(`Export failed: ${errorMessage(e)}`, 'error');
    } finally {
      this.recording = false;
    }
    for (const { node } of sims) this.cacheOf(node.id).simVersion++;
  }

  /**
   * Atlas of variations (particle / decal variants): the same graph rendered with a different
   * seed in each cell. Every node of the chain shifts its seed (own seeds included).
   */
  private async exportVariations(): Promise<void> {
    const id = this.exportNode.id;
    const choice = await askFlipbookOptions(
      'variations',
      this.renderer.gpu.caps.maxTextureSize,
      { columns: 4, rows: 4, frameSize: 256, startTime: this.time },
      (s) => imageDims(s, this.state.aspect),
    );
    if (!choice) return;
    const native = this.nativePixelSize();
    const opts = native ? { ...choice, frameSize: native } : choice;
    const chain = this.chainFor(id, opts.startTime, true);
    try {
      const frame = imageDims(opts.frameSize, this.state.aspect);
      const blob = await renderFlipbook(this.renderer, opts, frame, (i) =>
        chain.map((step) => ({
          ...step,
          req: { ...step.req, seed: (step.req.seed + i * VARIATION_SEED_STEP) % (MAX_SEED + 1) },
        })),
      );
      downloadBlob(blob, `${this.fileBase()}-variations-${opts.columns}x${opts.rows}.png`);
      toast(`Exported ${opts.columns * opts.rows} variations`);
    } catch (e) {
      toast(`Export failed: ${errorMessage(e)}`, 'error');
    }
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
    this.updatePreview3D();

    this.updateTimeline();
    this.updateFps(dt);
    requestAnimationFrame(this.frame);
  };

  /** Advances every simulation node (painting on a paused selected one steps it too). */
  private stepSimulations(): void {
    // A video export steps the simulations itself (in real time): the loop leaves them alone.
    if (this.recording) return;
    const steps = this.playing ? this.consumeSteps() : 0;
    for (const node of this.state.nodes) {
      const def = getGenerator(node.generator);
      if (def?.kind !== 'simulation' || this.failed.has(node.id) || node.frozenAt !== null)
        continue;
      // Still compiling in the background: it starts once its programs are ready.
      if (!this.renderer.simulationReady(def, node.id)) continue;
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
      this.nodeContent(node),
      this.assetVersion,
      node.seed ?? this.state.seed,
      size,
      time,
      sim,
      upstream,
    ]);
  }

  /** Serialized settings of a node (nodes are immutable: computed once per node object). */
  private readonly nodeContents = new WeakMap<GraphNode, string>();

  private nodeContent(node: GraphNode): string {
    let content = this.nodeContents.get(node);
    if (content === undefined) {
      content = JSON.stringify([
        node.generator,
        node.params,
        node.post,
        node.ramp,
        node.postEnabled,
        node.code,
        node.customParams,
        node.baseParamEdits,
      ]);
      this.nodeContents.set(node, content);
    }
    return content;
  }

  /** Re-renders the nodes whose inputs changed, then draws every card on the canvas. */
  private draw(): void {
    const rects = this.viewport.nodeRects();
    // Adaptive preview: while a value is being dragged on a slow frame rate, render the
    // selected node at half size to keep the UI responsive; full size comes back as soon as
    // editing pauses.
    const full = Math.min(this.state.resolution, PAUSED_TEST ? 256 : MAX_PREVIEW_SIZE);
    const interacting = performance.now() - this.lastChange < ADAPTIVE_IDLE_MS;
    this.degraded = interacting && this.frameMs > ADAPTIVE_SLOW_MS && full > 256;
    const selectedSize = this.degraded ? full / 2 : full;
    let pending = false;
    let rendered = false;

    for (const stateNode of fullEvaluationOrder(this.state)) {
      const node = this.liveNode(stateNode);
      if (this.failed.has(node.id)) continue;
      const cache = this.cacheOf(node.id);
      const rect = rects.get(node.id);
      // Reroutes have no image on the graph: they pass on a full-quality copy.
      const reroute = getGenerator(node.generator)?.role === 'reroute';
      const size =
        node.id === this.state.selectedId
          ? selectedSize
          : reroute
            ? Math.min(full, MAX_UNSELECTED_SIZE)
            : clamp(
                nextPow2((rect?.width ?? MIN_NODE_SIZE) * this.viewTiles),
                MIN_NODE_SIZE,
                Math.min(full, MAX_UNSELECTED_SIZE),
              );
      const signature = this.signature(node, size, cache);
      if (signature === cache.signature) continue;
      const inputs = this.liveInputs(node.id);
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
        rendered = true;
      } catch (e) {
        // Still compiling in the background: keep the last image, retry next frame.
        if (e instanceof ProgramPending) pending = true;
        else this.showRenderError(node.id, e);
      }
    }
    this.graphPending = pending;

    const items: DisplayItem[] = [];
    let displayKey = '';
    const magnified = this.viewport.magnified;
    // Back to front (the rects come in stacking order): the card in front draws last.
    for (const [id, rect] of rects) {
      const node = nodeById(this.state, id);
      if (!node) continue;
      const texture = this.nodeCaches.get(node.id)?.targets.output?.texture;
      if (!rect || !texture) continue;
      const selected = node.id === this.state.selectedId;
      const preview = this.pinPreview?.id === node.id ? this.pinPreview.channel : undefined;
      displayKey += `${id}:${this.nodeCaches.get(id)?.version},${rect.x},${rect.y},${rect.width},${rect.height},${selected && magnified},${preview};`;
      items.push({
        texture,
        ...rect,
        tiles: this.viewTiles,
        nearest: selected && magnified,
        dim: 0,
        ...(preview !== undefined ? { channel: preview } : {}),
      });
    }
    const { width, height } = this.viewport.canvasSize();
    // Nothing moved nor changed: the canvas keeps its last image (an idle editor costs ~0).
    displayKey += `${width}x${height}/${this.viewTiles}`;
    if (rendered || displayKey !== this.displayKey) {
      this.displayKey = displayKey;
      this.renderer.display(items, width, height);
    }
    this.detectTransparency();
    this.viewport.setRenderSize(imageDims(selectedSize, this.state.aspect)[0]);
  }

  /** Connected inputs of a node, from the live images of the nodes upstream. */
  private liveInputs(id: string): Record<string, RenderTarget> {
    const inputs: Record<string, RenderTarget> = {};
    for (const [input, link] of Object.entries(inputLinks(this.state.links, id))) {
      const upstream = this.nodeCaches.get(link.from);
      const fromNode = nodeById(this.state, link.from);
      const fromDef = fromNode ? getGenerator(fromNode.generator) : undefined;
      const out =
        upstream && fromDef
          ? this.renderer.outputOf(fromDef, upstream.targets, link.output)
          : undefined;
      if (out) inputs[input] = out;
    }
    return inputs;
  }

  // ---- 3D preview ---------------------------------------------------------------------------

  private readonly preview3d = new Preview3D();
  /** What the 3D preview shows (redrawn when it changes). */
  private preview3dKey = '';
  /** Height map of the previewed node (its Post Process height output). */
  private preview3dTargets: NodeTargets | null = null;

  /**
   * Renders the 3D preview of the exported node when it is visible and its image, the view or
   * the panel size changed. Relief comes from the node's height output (Post Process), or
   * its image when the post is off.
   */
  private updatePreview3D(): void {
    const panel = this.preview3d;
    if (!panel.visible) return;
    const node = this.exportNode;
    const cache = this.nodeCaches.get(node.id);
    const color = cache?.targets.output;
    if (!cache || !color || this.failed.has(node.id)) return;
    const [w, hgt] = panel.size();
    const key = `${node.id}:${cache.version}:${panel.version}:${w}x${hgt}`;
    if (key === this.preview3dKey) return;
    let height = color.texture;
    if (node.postEnabled) {
      this.preview3dTargets ??= this.renderer.createTargets();
      try {
        const req = this.requestFor(this.liveNode(node), this.time, false);
        this.renderer.renderNode(
          {
            ...req,
            post: { ...req.post, output: MAP_OUTPUT.height },
            inputs: this.liveInputs(node.id),
          },
          this.preview3dTargets,
          color.width,
          color.height,
        );
        height = this.preview3dTargets.output?.texture ?? color.texture;
      } catch (e) {
        if (e instanceof ProgramPending) return;
      }
    }
    const pixels = this.renderer.renderPreview3D(
      color.texture,
      height,
      panel.view(w / hgt),
      w,
      hgt,
    );
    if (!pixels) return;
    this.preview3dKey = key;
    panel.show(pixels, w, hgt);
  }

  /**
   * Finds the nodes with transparent pixels (their alpha pin stays visible) by reading back a
   * tiny resampling of the image. A node is checked again when its image changed, at most twice
   * a second, and a couple of nodes per frame.
   */
  private detectTransparency(): void {
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
      const transparent = this.renderer.isTransparent(texture);
      if (this.transparent.has(node.id) !== transparent) {
        if (transparent) this.transparent.add(node.id);
        else this.transparent.delete(node.id);
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
      this.thumbnails.set(def.id, SIM_THUMBNAIL, url);
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
      // Compiling in the background: never block the page on a hover.
      if (!this.renderer.prepare(def)) {
        setTimeout(next, 50);
        return;
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
  /** Stored thumbnails are loaded (requests wait for them, most need no render). */
  private thumbnailsLoaded = false;
  /** Fingerprint of each generator's thumbnail (sources + settings). */
  private readonly thumbHashes = new Map<string, string>();

  private thumbnailHash(def: ShaderGenerator, req: FrameRequest): string {
    let hash = this.thumbHashes.get(def.id);
    if (hash === undefined) {
      const { params, post, ramp, time, seed } = req;
      hash = fnv1a(
        JSON.stringify([THUMBNAIL_SIZE, params, post, ramp, time, seed]) +
          this.renderer.shaderSources(def),
      );
      this.thumbHashes.set(def.id, hash);
    }
    return hash;
  }

  private featuredThumbnail(def: ShaderGenerator): FrameRequest {
    const featured = def.presets?.find((p) => p.name === def.featuredPreset);
    return this.thumbnailRequest(def, featured);
  }

  /**
   * Thumbnails are rendered lazily, only for tiles that scroll into view and whose stored
   * image is missing or stale (simulations get theirs from the live preview instead).
   */
  private requestThumbnail(id: string): void {
    const def = getGenerator(id);
    if (
      LITE ||
      !this.thumbnailsLoaded ||
      !def ||
      def.kind !== 'shader' ||
      isOperator(def) ||
      this.thumbDone.has(id) ||
      this.thumbQueue.includes(id)
    )
      return;
    const stored = this.thumbnails.get(id, this.thumbnailHash(def, this.featuredThumbnail(def)));
    if (stored) {
      this.thumbDone.add(id);
      return;
    }
    this.thumbQueue.push(id);
    this.scheduleThumbnails(30);
  }

  private scheduleThumbnails(delay: number): void {
    this.thumbTimer ??= setTimeout(() => this.renderNextThumbnail(), delay);
  }

  /**
   * One thumbnail per tick. The graph goes first (nothing renders while its nodes compile);
   * a few generators compile ahead in the background, the first ready one is rendered.
   */
  private renderNextThumbnail(): void {
    this.thumbTimer = undefined;
    if (this.graphPending) {
      this.scheduleThumbnails(100);
      return;
    }
    let rendered = false;
    for (const id of this.thumbQueue.slice(0, THUMBNAIL_COMPILES)) {
      const def = getGenerator(id);
      if (def?.kind === 'shader' && !this.renderer.prepare(def)) continue;
      this.thumbQueue.splice(this.thumbQueue.indexOf(id), 1);
      if (def?.kind !== 'shader') continue;
      try {
        this.thumbCapture ??= this.renderer.createCapture(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
        const req = this.featuredThumbnail(def);
        const url = captureToDataUrl(this.thumbCapture, req);
        this.thumbnails.set(def.id, this.thumbnailHash(def, req), url);
        this.generatorList.setThumbnail(def.id, url);
        this.thumbDone.add(def.id);
      } catch (e) {
        console.warn(`Thumbnail failed for ${def.id}`, e);
      }
      rendered = true;
      break;
    }
    if (this.thumbQueue.length > 0) this.scheduleThumbnails(rendered ? 16 : 50);
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
      } else if (mod && e.key.toLowerCase() === 'x' && !window.getSelection()?.toString()) {
        this.cutNodes();
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

  /** Ctrl+C: the selected nodes and the links between them (in-app clipboard). */
  private copyNodes(ids: readonly string[] = this.viewport.selectedIds(), quiet = false): void {
    const set = new Set(ids);
    const nodes = this.state.nodes.filter(
      (n) => set.has(n.id) && getGenerator(n.generator)?.role !== 'output',
    );
    if (!nodes.length) {
      if (quiet) this.clipboard = null;
      return;
    }
    const copied = new Set(nodes.map((node) => node.id));
    this.clipboard = {
      nodes,
      links: this.state.links.filter((l) => copied.has(l.from) && copied.has(l.to)),
    };
    if (!quiet) toast(`Copied ${nodes.length} node${nodes.length > 1 ? 's' : ''}`);
  }

  /** Ctrl+X: copies the selected nodes, then deletes them. */
  private cutNodes(ids: readonly string[] = this.viewport.selectedIds()): void {
    if (ids.length >= this.state.nodes.length) {
      toast('The last node cannot be cut', 'error');
      return;
    }
    this.copyNodes(ids, true);
    this.deleteNodes(ids);
  }

  /**
   * Ctrl+V: copies of the clipboard nodes (settings and inner links kept) at `at` (graph
   * units), under the pointer, or offset from the originals; they become the selection.
   */
  private pasteNodes(target?: readonly [number, number]): void {
    const clip = this.clipboard;
    if (!clip?.nodes.length) return;
    const minX = Math.min(...clip.nodes.map((n) => n.x));
    const minY = Math.min(...clip.nodes.map((n) => n.y));
    const at = target ?? this.viewport.pointerWorld();
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
    this.commit({
      ...this.state,
      nodes,
      links: [...this.state.links, ...links],
      selectedId: primary,
    });
    this.viewport.selectMany(pasted, primary);
  }

  private clipboard: { nodes: readonly GraphNode[]; links: readonly GraphLink[] } | null = null;
  private postClipboard: Pick<GraphNode, 'post' | 'ramp' | 'postEnabled'> | null = null;

  private duplicateNode(): void {
    const source = this.node;
    if (getGenerator(source.generator)?.role === 'output') return;
    const [x, y] = this.viewport.placementNear(source.id);
    const copy: GraphNode = { ...source, id: newNodeId(this.state.nodes), x, y };
    this.commit(withAddedNode(this.state, copy));
  }
}
