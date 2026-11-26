import type {
  Community,
  CommunityCategory,
  CommunityKind,
  CommunityQuery,
  CommunityScope,
  CommunitySort,
  CommunitySummary,
  CommunitySystem,
  PublicationKind,
  PublishFields,
  ReportedSystem,
  ReportReason,
} from '../app/community';
import { REPORT_REASONS } from '../app/community';
import type { NodeLink } from '../app/communityNodes';
import type { PreviewFraming, PublishedLink, PublishState } from '../app/library';
import { publicationVersion } from '../app/library';
import { confirmDialog } from './ConfirmDialog';
import { openContextMenu, type ContextMenuEntry } from './ContextMenu';
import { h } from './dom';
import { icon, type IconName } from './icons';
import { segmentedTabs } from './Panel';
import type { PreviewResult } from './PreviewStudio';
import { toast } from './toast';

/** The open system as seen by the community window. */
export interface CurrentSystem {
  readonly name: string;
  /** Local only, published as is, or edited since it was published. */
  readonly state: PublishState;
  readonly link: PublishedLink | null;
  readonly animated: boolean;
}

export interface CommunityActions {
  readonly community: Community;
  readonly signedIn: () => boolean;
  /** Opens the sign-in window. */
  readonly signIn: () => void;
  readonly current: () => CurrentSystem;
  /**
   * Images of a version of the open system: framed like `framing` (default: whole image), or
   * chosen in the preview editor when `interactive` (null if cancelled).
   */
  readonly preview: (
    interactive: boolean,
    framing: PreviewFraming | undefined,
  ) => Promise<PreviewResult | null>;
  /** Publishes the open system (it becomes linked to the new community system). */
  readonly publishCurrent: (
    fields: PublishFields,
    media: PreviewResult,
    animated: boolean,
  ) => Promise<string>;
  /**
   * Publishes the open system as a new version of community system `id` (default: the one it
   * is linked to) and links them. Returns the new version.
   */
  readonly publishUpdate: (
    media: PreviewResult,
    id: string,
    animated: boolean,
  ) => Promise<number | null>;
  readonly canAnimate: (system: CommunitySystem) => boolean;
  readonly editPublishedPreview: (
    system: CommunitySystem,
    framing?: PreviewFraming,
  ) => Promise<PreviewResult | null>;
  readonly editPublication: (
    system: CommunitySystem,
    fields: PublishFields,
    animated: boolean,
    preview: PreviewResult | null,
  ) => Promise<void>;
  /** Copies a community system into the library and opens it. */
  readonly copyToLibrary: (system: CommunitySystem) => void;
  /** A community system was deleted: library systems linked to it become local. */
  readonly forget: (id: string) => void;
  /** Shader nodes: the node that "Publish" sends (the selected one). */
  readonly nodes: CommunityNodeActions;
  /** The window closed. */
  readonly closed?: () => void;
}

/** The selected node as seen by the community window. */
export interface CurrentNode {
  readonly name: string;
  /** A custom shader node (edited code or its own parameters). */
  readonly publishable: boolean;
  readonly animated: boolean;
  /** Local, published as is, or edited since you published it. */
  readonly state: PublishState;
  /** Your community node it is published as. */
  readonly link: NodeLink | null;
}

/** One of your published nodes, in the open system, edited since it was published. */
export interface UnpublishedNode {
  readonly nodeId: string;
  readonly link: NodeLink;
}

export interface CommunityNodeActions {
  readonly current: () => CurrentNode;
  /** Images of the selected node alone (chosen in the preview editor when interactive). */
  readonly preview: (
    interactive: boolean,
    framing: PreviewFraming | undefined,
  ) => Promise<PreviewResult | null>;
  /** Publishes the selected node as a new community node; returns its id. */
  readonly publish: (
    fields: PublishFields,
    media: PreviewResult,
    animated: boolean,
  ) => Promise<string>;
  /** Publishes the selected node as the next version of community node `id`. */
  readonly publishUpdate: (
    media: PreviewResult,
    id: string,
    animated: boolean,
  ) => Promise<number | null>;
  /** Installed version of community node `id`, or null. */
  readonly installedVersion: (id: string) => number | null;
  /** Installs (or updates) a community node: it shows in the node browser. */
  readonly install: (system: CommunitySystem) => boolean;
  readonly uninstall: (id: string) => void;
  /** Adds a copy of the node to the open system (no install). */
  readonly addToGraph: (system: CommunitySystem) => boolean;
  /** Your published nodes of the open system with unpublished changes. */
  readonly unpublished: () => readonly UnpublishedNode[];
  /** Selects node `nodeId` of the open system (it becomes the one "Publish" sends). */
  readonly select: (nodeId: string) => void;
}

export interface CommunityOpenOptions {
  /** Starts on systems (default) or shader nodes. */
  readonly type?: PublicationKind;
  /** Starts on the publication form of the selected node. */
  readonly publishNode?: boolean;
  /** Starts on the publication form of the open system (or its update when published). */
  readonly publish?: boolean;
  readonly libraryPublish?: boolean;
  /** Starts on a community system's page. */
  readonly view?: string;
  /** Starts on the details form of one of your community systems. */
  readonly edit?: string;
}

const TYPES: readonly {
  id: PublicationKind;
  title: string;
  icon: IconName;
  tooltip: string;
}[] = [
  {
    id: 'system',
    title: 'Systems',
    icon: 'library',
    tooltip: 'Whole effects (node graphs) to open and adapt',
  },
  {
    id: 'node',
    title: 'Shader nodes',
    icon: 'nodes',
    tooltip: 'Custom GLSL nodes to install and reuse like generators',
  },
];
const SCOPES: readonly { id: CommunityScope; title: string; icon: IconName }[] = [
  { id: 'all', title: 'Discover', icon: 'search' },
  { id: 'subscribed', title: 'Subscribed', icon: 'check' },
  { id: 'mine', title: 'Mine', icon: 'account' },
];
const KINDS: readonly { id: CommunityKind; title: string; icon: IconName }[] = [
  { id: 'all', title: 'All', icon: 'grid' },
  { id: 'animated', title: 'Animated', icon: 'film' },
  { id: 'static', title: 'Static', icon: 'texture' },
];
const SORTS: readonly { id: CommunitySort; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'popular', label: 'Most subscribed' },
  { id: 'new', label: 'Newest' },
];
/** Hover animation speed (ms per frame of the strip). */
const HOVER_FRAME_MS = 110;

function when(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isMissing(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e as { status?: number }).status === 404 &&
    e.message === 'No such system'
  );
}

/** The GLSL of a node package (shown read-only on its page), or ''. */
function packageCode(document: unknown): string {
  const nodes = (document as { nodes?: unknown } | null)?.nodes;
  const node: unknown = Array.isArray(nodes) ? nodes[0] : null;
  const code = (node as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : '';
}

/**
 * Community window: browse the systems and custom shader nodes people share (animated or
 * static; trending, most subscribed, newest, by category or search; animations play on
 * hover), subscribe to them, copy systems into the library, install nodes into the node
 * browser; publish the open system or the selected custom node, then publish their updates,
 * edit or delete your own publications.
 */
export function openCommunity(actions: CommunityActions, opts: CommunityOpenOptions = {}): void {
  const { community } = actions;
  const query: { -readonly [K in keyof CommunityQuery]: CommunityQuery[K] } = {
    type: opts.type ?? (opts.publishNode ? 'node' : 'system'),
    scope: 'all',
    kind: 'all',
    sort: 'trending',
    category: '',
    q: '',
    page: 0,
  };
  let categories: readonly CommunityCategory[] = [];
  let items: CommunitySummary[] = [];
  let more = false;
  let loading = 0;

  const dialog = h('dialog', { class: 'dialog library-dialog community-dialog' });
  const close = () => dialog.close();
  const body = h('div', { class: 'community-body' });
  const search = h('input', {
    type: 'search',
    class: 'search',
    placeholder: 'Search systems, tags, authors',
    'aria-label': 'Search the community',
  });
  const sortSelect = h(
    'select',
    { class: 'community-select', 'aria-label': 'Sort' },
    ...SORTS.map((s) => h('option', { value: s.id, text: s.label })),
  );
  const categorySelect = h('select', { class: 'community-select', 'aria-label': 'Category' });
  const publishArea = h('div', { class: 'community-publish' });

  const requireAccount = (what: string): boolean => {
    if (actions.signedIn()) return true;
    toast(`Sign in to ${what}`, 'info', 4000, { label: 'Sign in', run: actions.signIn });
    return false;
  };
  const nodes = () => query.type === 'node';
  /** "system" / "node", for messages. */
  const noun = (item?: { kind?: PublicationKind }) =>
    (item ? item.kind === 'node' : nodes()) ? 'node' : 'system';
  const typeTabs = segmentedTabs(TYPES, (id) => {
    query.type = id as PublicationKind;
    updatePlaceholder();
    void load();
  });
  typeTabs.element.classList.add('community-types');
  const updatePlaceholder = () => {
    search.placeholder = nodes()
      ? 'Search shader nodes, tags, authors'
      : 'Search systems, tags, authors';
  };
  const scopeTabs = segmentedTabs(SCOPES, (id) => {
    if (id !== 'all' && !requireAccount(`see your ${noun()}s`)) {
      scopeTabs.select(query.scope);
      return;
    }
    query.scope = id as CommunityScope;
    void load();
  });
  const kindTabs = segmentedTabs(KINDS, (id) => {
    query.kind = id as CommunityKind;
    void load();
  });
  kindTabs.element.classList.add('community-kinds');
  const bar = h(
    'div',
    { class: 'community-bar' },
    scopeTabs.element,
    kindTabs.element,
    sortSelect,
    categorySelect,
  );

  const label = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const message = (text: string) => h('p', { class: 'library-empty', text });
  const renderTabs = () => {
    typeTabs.select(query.type);
    scopeTabs.select(query.scope);
    kindTabs.select(query.kind);
  };

  /**
   * "Publish selected node" (enabled on a custom shader node), "Up to date" or "Publish node
   * update" when it is one of your published nodes.
   */
  const renderNodePublishButton = () => {
    const current = actions.nodes.current();
    const link = current.link;
    if (link && current.state === 'published') {
      publishArea.replaceChildren(
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-small community-uptodate',
            title: `The selected node is "${link.name}", published without local changes`,
            onclick: () => void showDetail(link.id),
          },
          icon('check', 12),
          'Node published · up to date',
        ),
      );
      return;
    }
    if (link && current.state === 'modified') {
      publishArea.replaceChildren(
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-small btn-primary',
            title: `The selected node ("${link.name}") has unpublished changes`,
            onclick: () => void showUpdate(link.id, link.name, link.version ?? undefined, true),
          },
          icon('download', 12),
          'Publish node update…',
        ),
      );
      return;
    }
    publishArea.replaceChildren(
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-small btn-primary',
          disabled: !current.publishable,
          title: current.publishable
            ? `Share "${current.name}" with its code, parameters and look`
            : 'Select a custom shader node (edited code or its own parameters) to publish it',
          onclick: () => void showPublishNode(),
        },
        icon('download', 12),
        'Publish selected node',
      ),
    );
  };

  /** "Publish current system", "Up to date" or "Publish update", for the open system. */
  const renderPublishButton = () => {
    if (nodes()) {
      renderNodePublishButton();
      return;
    }
    const current = actions.current();
    const link = current.link;
    if (current.state === 'published' && link) {
      publishArea.replaceChildren(
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-small community-uptodate',
            title: `"${current.name}" is published without local changes`,
            onclick: () => void showDetail(link.id),
          },
          icon('check', 12),
          'Published · up to date',
        ),
      );
    } else if (current.state === 'modified' && link) {
      publishArea.replaceChildren(
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-small btn-primary',
            title: `"${current.name}" has unpublished changes`,
            onclick: () => void showUpdate(),
          },
          icon('download', 12),
          'Publish update…',
        ),
      );
    } else {
      publishArea.replaceChildren(
        h(
          'button',
          { type: 'button', class: 'btn btn-small btn-primary', onclick: () => void showPublish() },
          icon('download', 12),
          opts.libraryPublish ? 'Publish system' : 'Publish current system',
        ),
      );
    }
  };

  // ---- List --------------------------------------------------------------------------------

  const cardMenu = (e: MouseEvent, item: CommunitySummary) => {
    e.preventDefault();
    const node = item.kind === 'node';
    const installed = node ? actions.nodes.installedVersion(item.id) : null;
    const nodeEntries: ContextMenuEntry[] = [
      {
        label:
          installed === null
            ? 'Install'
            : installed < item.version
              ? `Update to v${item.version}`
              : 'Uninstall',
        run: () =>
          void (installed !== null && installed >= item.version
            ? uninstall(item)
            : install(item.id)),
      },
      { label: 'Add to the graph', run: () => void addToGraph(item.id) },
    ];
    const entries: ContextMenuEntry[] = [
      { label: 'Details', run: () => void showDetail(item.id) },
      ...(node ? nodeEntries : [{ label: 'Open a copy', run: () => void copy(item.id) }]),
      ...(item.mine
        ? [
            null,
            { label: 'Edit details…', run: () => void showEditById(item.id) },
            {
              label: node ? 'Replace with the selected node…' : 'Replace with the open system…',
              disabled: node && !actions.nodes.current().publishable,
              run: () => void replaceWithCurrent(item),
            },
            { label: 'Delete', run: () => void remove(item) },
          ]
        : [
            {
              label: item.subscribed ? 'Unsubscribe' : 'Subscribe',
              run: () => void toggleSubscription(item),
            },
            null,
            { label: 'Report…', run: () => void report(item) },
          ]),
    ];
    openContextMenu(e.clientX, e.clientY, entries, dialog);
  };

  /** Plays the hover animation strip of an animated system over its thumbnail. */
  const bindHoverAnimation = (thumb: HTMLElement, item: CommunitySummary) => {
    if (!item.animated || !item.previewFrames) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let layer: HTMLElement | null = null;
    let hovering = false;
    thumb.addEventListener('pointerenter', () => {
      hovering = true;
      void community.preview(item.id).then((strip) => {
        if (!strip || !hovering || !thumb.isConnected) return;
        layer ??= h('span', { class: 'community-anim' });
        layer.style.backgroundImage = `url("${strip.url}")`;
        layer.style.backgroundSize = `${strip.frames * 100}% 100%`;
        thumb.append(layer);
        let i = 0;
        clearInterval(timer);
        timer = setInterval(() => {
          if (!thumb.isConnected) {
            clearInterval(timer);
            return;
          }
          i = (i + 1) % strip.frames;
          layer!.style.backgroundPosition = `${(i / (strip.frames - 1)) * 100}% 0`;
        }, HOVER_FRAME_MS);
      });
    });
    thumb.addEventListener('pointerleave', () => {
      hovering = false;
      clearInterval(timer);
      layer?.remove();
    });
  };

  const card = (item: CommunitySummary) => {
    const node = item.kind === 'node';
    const copied = node
      ? actions.nodes.installedVersion(item.id)
      : community.copiedVersion(item.id);
    const updated = copied !== null && copied < item.version;
    const thumb = h(
      'span',
      { class: 'library-thumb' },
      item.thumb ? h('img', { src: item.thumb, alt: '', draggable: false }) : null,
      updated ? h('span', { class: 'community-badge', text: 'Update' }) : null,
      node && copied !== null && !updated && !item.mine
        ? h('span', { class: 'community-badge installed', text: 'Installed' })
        : null,
      item.mine ? h('span', { class: 'community-badge mine', text: 'Yours' }) : null,
      item.hidden
        ? h('span', {
            class: 'community-badge hidden',
            text: 'Hidden',
            title: 'Hidden after reports: under review, only you and moderators see it',
          })
        : null,
      item.animated
        ? h('span', { class: 'community-kind-badge', title: 'Animated' }, icon('film', 11))
        : null,
    );
    bindHoverAnimation(thumb, item);
    return h(
      'div',
      {
        class: 'library-card community-card',
        role: 'button',
        tabIndex: 0,
        title: item.description || item.name,
        onclick: () => void showDetail(item.id),
        onkeydown: (e: KeyboardEvent) => {
          if (e.key === 'Enter') void showDetail(item.id);
        },
        oncontextmenu: (e: MouseEvent) => cardMenu(e, item),
      },
      thumb,
      h('span', { class: 'library-name', text: item.name }),
      h(
        'span',
        { class: 'library-date' },
        h('span', { text: `${item.author} · ${label(item.category)}` }),
        h('span', {
          class: `community-subs${item.subscribed ? ' on' : ''}`,
          text: `★ ${item.subscribers}`,
        }),
      ),
    );
  };

  const renderList = () => {
    bar.hidden = false;
    renderPublishButton();
    const grid = items.length ? h('div', { class: 'library-grid' }, ...items.map(card)) : null;
    const empty =
      items.length === 0
        ? message(
            query.scope === 'mine'
              ? 'You have not published anything yet.'
              : query.scope === 'subscribed'
                ? 'No subscription yet.'
                : 'Nothing found.',
          )
        : null;
    const moreBtn = more
      ? h('button', {
          type: 'button',
          class: 'btn community-more',
          text: 'Load more',
          onclick: () => {
            query.page++;
            void load(true);
          },
        })
      : null;
    body.replaceChildren(...[grid, empty, moreBtn].filter((el) => el !== null));
  };

  async function ensureCategories(): Promise<boolean> {
    if (categories.length) return true;
    try {
      categories = await community.categories();
      categorySelect.replaceChildren(
        h('option', { value: '', text: 'All categories' }),
        ...categories.map((c) => h('option', { value: c.id, text: c.label })),
      );
      categorySelect.value = query.category;
      return true;
    } catch (e) {
      body.replaceChildren(message(`The community is unavailable: ${errorText(e)}`));
      return false;
    }
  }

  async function load(append = false): Promise<void> {
    if (!append) query.page = 0;
    const token = ++loading;
    if (!append) body.replaceChildren(message('Loading…'));
    if (!(await ensureCategories())) return;
    try {
      const request = { ...query };
      const r = await community.list(request);
      if (token !== loading) return;
      const matching = r.items.filter(
        (item) =>
          request.kind === 'all' || (item.animated === true) === (request.kind === 'animated'),
      );
      items = append ? [...items, ...matching] : matching;
      more = r.more;
      renderList();
    } catch (e) {
      if (token !== loading) return;
      body.replaceChildren(message(`The community is unavailable: ${errorText(e)}`));
    }
  }

  // ---- Reports and moderation --------------------------------------------------------------

  /** Asks why `item` should be reviewed, then sends the report. */
  async function report(item: CommunitySummary): Promise<void> {
    if (!requireAccount(`report a ${noun(item)}`)) return;
    const reason = h(
      'select',
      { name: 'reason', 'aria-label': 'Reason' },
      ...REPORT_REASONS.map((r) => h('option', { value: r.id, text: r.label })),
    );
    const details = h('textarea', {
      name: 'details',
      maxLength: 500,
      rows: 3,
      placeholder: 'Details (optional)',
      'aria-label': 'Details',
    });
    const field = (text: string, input: HTMLElement) =>
      h('label', { class: 'dialog-field' }, h('span', { text }), input);
    const form = h(
      'form',
      { method: 'dialog' },
      h('h2', { text: `Report "${item.name}"` }),
      h('p', {
        class: 'dialog-info',
        text: 'Moderators review reported publications. Several reports hide it in the meantime.',
      }),
      field('Reason', reason),
      field('Details', details),
      h(
        'div',
        { class: 'dialog-buttons' },
        h('button', {
          type: 'button',
          class: 'btn',
          text: 'Cancel',
          onclick: () => box.close('cancel'),
        }),
        h('button', { type: 'submit', class: 'btn btn-primary', value: 'ok', text: 'Report' }),
      ),
    );
    const box = h('dialog', { class: 'dialog' }, form);
    const sent = await new Promise<boolean>((resolve) => {
      box.addEventListener('close', () => {
        box.remove();
        resolve(box.returnValue === 'ok');
      });
      dialog.append(box);
      box.showModal();
    });
    if (!sent) return;
    try {
      await community.report(item.id, reason.value as ReportReason, details.value);
      toast('Thanks: moderators will review it');
    } catch (e) {
      toast(`Report failed: ${errorText(e)}`, 'error');
    }
  }

  const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

  /** Moderators: reported or hidden systems, with their reports and the decisions. */
  async function showModeration(): Promise<void> {
    bar.hidden = true;
    body.replaceChildren(message('Loading…'));
    let list: ReportedSystem[];
    try {
      list = await community.reports();
    } catch (e) {
      body.replaceChildren(message(errorText(e)));
      return;
    }
    const decide = async (run: () => Promise<void>, done: string) => {
      try {
        await run();
        toast(done);
      } catch (e) {
        toast(errorText(e), 'error');
      }
      void showModeration();
    };
    const row = (item: ReportedSystem) =>
      h(
        'div',
        { class: 'moderation-row' },
        h(
          'span',
          { class: 'library-thumb' },
          item.thumb ? h('img', { src: item.thumb, alt: '', draggable: false }) : null,
        ),
        h(
          'div',
          { class: 'moderation-info' },
          h('strong', { text: item.name }),
          h('span', {
            class: 'library-date',
            text: `${item.kind === 'node' ? 'Shader node' : 'System'} · ${item.author} · ${item.reportCount} report${item.reportCount === 1 ? '' : 's'}${item.hidden ? ' · hidden' : ''}`,
          }),
          h(
            'ul',
            { class: 'moderation-reports' },
            ...item.reports.map((r) =>
              h('li', {
                text: `${reasonLabel(r.reason)} — ${r.by}, ${when(r.at)}${r.details ? `: ${r.details}` : ''}`,
              }),
            ),
          ),
        ),
        h(
          'div',
          { class: 'moderation-actions' },
          h('button', {
            type: 'button',
            class: 'btn btn-small',
            text: 'View',
            onclick: () => void showDetail(item.id),
          }),
          h('button', {
            type: 'button',
            class: 'btn btn-small',
            text: item.hidden ? 'Restore' : 'Hide',
            title: item.hidden ? 'Show it again and dismiss its reports' : 'Hide it from everyone',
            onclick: () =>
              void decide(
                () => community.moderate(item.id, !item.hidden, item.hidden),
                item.hidden ? 'Restored' : 'Hidden',
              ),
          }),
          item.hidden
            ? null
            : h('button', {
                type: 'button',
                class: 'btn btn-small',
                text: 'Dismiss',
                title: 'Keep it visible and clear its reports',
                onclick: () =>
                  void decide(() => community.moderate(item.id, false, true), 'Reports dismissed'),
              }),
          h('button', {
            type: 'button',
            class: 'btn btn-small',
            text: 'Delete',
            onclick: () =>
              void confirmDialog({
                title: `Delete "${item.name}"?`,
                message: `The publication of ${item.author} is removed for everyone.`,
                confirmLabel: 'Delete',
                irreversible: true,
              }).then((ok) => {
                if (ok) void decide(() => community.remove(item.id), 'Deleted');
              }),
          }),
        ),
      );
    body.replaceChildren(
      h(
        'div',
        { class: 'moderation-head' },
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: '← Back',
          onclick: () => void load(),
        }),
        h('strong', { text: 'Moderation' }),
      ),
      ...(list.length ? list.map(row) : [message('Nothing to review.')]),
    );
  }

  // ---- Detail ------------------------------------------------------------------------------

  async function showDetail(id: string): Promise<void> {
    bar.hidden = true;
    renderPublishButton();
    body.replaceChildren(message('Loading…'));
    await ensureCategories();
    let system: CommunitySystem;
    try {
      system = await community.get(id);
    } catch (e) {
      if (isMissing(e)) actions.forget(id);
      body.replaceChildren(message(errorText(e)));
      return;
    }
    const type = system.kind ?? 'system';
    if (type !== query.type) {
      query.type = type;
      renderTabs();
      updatePlaceholder();
      renderPublishButton();
    }
    if (type === 'node') {
      showNodeDetail(system);
      return;
    }
    const copied = community.copiedVersion(system.id);
    const current = actions.current();
    const linked = current.link?.id === system.id;
    const buttons: HTMLElement[] = [];
    if (system.mine && linked && current.state === 'modified')
      buttons.push(button('Publish update…', () => void showUpdate(), true));
    buttons.push(
      button(
        copied !== null && copied < system.version ? 'Open the new version' : 'Open a copy',
        () => {
          community.markCopied(system.id, system.version);
          close();
          actions.copyToLibrary(system);
        },
        !(system.mine && linked && current.state === 'modified'),
      ),
    );
    if (system.mine) {
      buttons.push(button('Edit details', () => void showEdit(system)));
      if (!linked)
        buttons.push(
          button('Replace with the open system…', () => void replaceWithCurrent(system)),
        );
      buttons.push(button('Delete', () => void remove(system)));
    } else {
      buttons.push(
        button(
          system.subscribed ? 'Unsubscribe' : 'Subscribe',
          () =>
            void toggleSubscription(system).then((on) => {
              if (on !== null) void showDetail(system.id);
            }),
        ),
      );
      buttons.push(button('Report…', () => void report(system)));
    }
    const status = linked
      ? h('p', {
          class: `community-link-state ${current.state}`,
          text:
            current.state === 'modified'
              ? `Your open system "${current.name}" has changes not published yet.`
              : `Your open system "${current.name}" is this version.`,
        })
      : null;
    renderDetail(system, buttons, status, copied);
  }

  const button = (text: string, run: () => void, primary = false) =>
    h('button', {
      type: 'button',
      class: `btn${primary ? ' btn-primary' : ''}`,
      text,
      onclick: run,
    });

  /** Page of a shader node: install / update, add to the graph, its code (read-only). */
  function showNodeDetail(system: CommunitySystem): void {
    const installed = actions.nodes.installedVersion(system.id);
    const current = actions.nodes.current();
    const buttons: HTMLElement[] = [];
    if (installed === null) buttons.push(button('Install', () => void install(system), true));
    else if (installed < system.version)
      buttons.push(button(`Update to v${system.version}`, () => void install(system), true));
    buttons.push(
      button('Add to the graph', () => {
        if (actions.nodes.addToGraph(system)) close();
      }),
    );
    if (installed !== null) buttons.push(button('Uninstall', () => void uninstall(system)));
    if (system.mine) {
      buttons.push(button('Edit details', () => void showEdit(system)));
      if (current.publishable)
        buttons.push(
          button('Replace with the selected node…', () => void replaceWithCurrent(system)),
        );
      buttons.push(button('Delete', () => void remove(system)));
    } else {
      buttons.push(
        button(
          system.subscribed ? 'Unsubscribe' : 'Subscribe',
          () =>
            void toggleSubscription(system).then((on) => {
              if (on !== null) void showDetail(system.id);
            }),
        ),
      );
      buttons.push(button('Report…', () => void report(system)));
    }
    const code = packageCode(system.document);
    const status =
      installed === null
        ? null
        : h('p', {
            class: `community-link-state ${installed < system.version ? 'modified' : 'published'}`,
            text:
              installed < system.version
                ? `You have v${installed} in your node browser.`
                : 'Installed: in the Community section of your node browser.',
          });
    renderDetail(
      system,
      buttons,
      status,
      installed,
      code
        ? h(
            'details',
            { class: 'community-code' },
            h('summary', { text: `GLSL code · ${code.split('\n').length} lines` }),
            h('pre', { class: 'community-code-view', text: code }),
          )
        : null,
    );
  }

  function renderDetail(
    system: CommunitySystem,
    buttons: readonly HTMLElement[],
    status: HTMLElement | null,
    copied: number | null,
    extra: HTMLElement | null = null,
  ): void {
    const thumb = h(
      'div',
      { class: 'community-detail-thumb' },
      system.thumb ? h('img', { src: system.thumb, alt: '' }) : null,
    );
    bindHoverAnimation(thumb, system);
    const node = system.kind === 'node';
    body.replaceChildren(
      h(
        'div',
        { class: 'community-detail' },
        h(
          'button',
          { type: 'button', class: 'btn btn-small community-back', onclick: () => void load() },
          icon('chevronDown', 14),
          'Back',
        ),
        h(
          'div',
          { class: 'community-detail-main' },
          thumb,
          h(
            'div',
            { class: 'community-detail-info' },
            h('h3', { text: system.name }),
            h('p', {
              class: 'community-meta',
              text: `${node ? 'Shader node · ' : ''}by ${system.author} · ${system.animated ? 'Animated' : 'Static'} · ${label(system.category)}${publicationVersion(system.version) === null ? '' : ` · v${system.version}`} · updated ${when(system.updated)}`,
            }),
            h('p', {
              class: 'community-meta',
              text: `★ ${system.subscribers} subscriber${system.subscribers === 1 ? '' : 's'} · ${system.uses} ${node ? `install${system.uses === 1 ? '' : 's'}` : `cop${system.uses === 1 ? 'y' : 'ies'}`}${copied !== null ? ` · you have v${copied}` : ''}`,
            }),
            h('p', {
              class: 'community-meta community-licence',
              text: 'Free to reuse in any project.',
            }),
            status,
            system.tags.length
              ? h(
                  'div',
                  { class: 'community-tags' },
                  ...system.tags.map((t) =>
                    h('button', {
                      type: 'button',
                      class: 'community-tag',
                      text: t,
                      title: 'Search this tag',
                      onclick: () => {
                        search.value = t;
                        query.q = t;
                        query.scope = 'all';
                        renderTabs();
                        void load();
                      },
                    }),
                  ),
                )
              : null,
            system.description
              ? h('p', { class: 'community-description', text: system.description })
              : null,
            h('div', { class: 'community-actions' }, ...buttons),
          ),
        ),
        extra,
      ),
    );
  }

  /** Installs (or updates) community node `id` / `system` into the node browser. */
  async function install(target: string | CommunitySystem): Promise<void> {
    try {
      const system = typeof target === 'string' ? await community.get(target) : target;
      if (!actions.nodes.install(system)) return;
      community.markCopied(system.id, system.version);
      toast(`"${system.name}" is in the Community section of the node browser`);
      refresh(system.id);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  async function uninstall(item: CommunitySummary): Promise<void> {
    const ok = await confirmDialog({
      title: `Uninstall "${item.name}"?`,
      message: 'It leaves the node browser. Nodes already in your systems stay as they are.',
      confirmLabel: 'Uninstall',
    });
    if (!ok) return;
    actions.nodes.uninstall(item.id);
    toast(`Uninstalled "${item.name}"`);
    refresh(item.id);
  }

  async function addToGraph(id: string): Promise<void> {
    try {
      if (actions.nodes.addToGraph(await community.get(id))) close();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  /** Redraws the list, or the page of `id` when it is open. */
  function refresh(id: string): void {
    if (bar.hidden) void showDetail(id);
    else renderList();
  }

  async function copy(id: string): Promise<void> {
    try {
      const system = await community.get(id);
      community.markCopied(system.id, system.version);
      close();
      actions.copyToLibrary(system);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  /** New subscription state, or null when it failed / needs an account. */
  async function toggleSubscription(item: CommunitySummary): Promise<boolean | null> {
    if (!requireAccount('subscribe')) return null;
    const on = !item.subscribed;
    try {
      await community.subscribe(item.id, on);
      toast(on ? `Subscribed to "${item.name}"` : `Unsubscribed from "${item.name}"`);
      items = items.map((i) =>
        i.id === item.id ? { ...i, subscribed: on, subscribers: i.subscribers + (on ? 1 : -1) } : i,
      );
      if (bar.hidden === false) renderList();
      return on;
    } catch (e) {
      toast(errorText(e), 'error');
      return null;
    }
  }

  async function remove(item: CommunitySummary): Promise<void> {
    const ok = await confirmDialog({
      title: `Delete "${item.name}" from the community?`,
      message:
        item.kind === 'node'
          ? 'People who installed it keep their copy; subscriptions are removed.'
          : 'People who copied it keep their copy; subscriptions are removed. Your library ' +
            'system stays, as a local system.',
      irreversible: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await community.remove(item.id);
      actions.forget(item.id);
      toast(`Deleted "${item.name}"`);
      void load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  /** Makes one of your publications a new version of the open system (and links them). */
  async function replaceWithCurrent(item: CommunitySummary): Promise<void> {
    if (item.kind === 'node') {
      const ok = await confirmDialog({
        title: `Replace "${item.name}"?`,
        message: `The next version of "${item.name}" will be the selected node ("${actions.nodes.current().name}"): its code, parameters and look.`,
        confirmLabel: 'Continue',
      });
      if (ok) void showUpdate(item.id, item.name, item.version, true);
      return;
    }
    const ok = await confirmDialog({
      title: `Replace "${item.name}"?`,
      message: `The next version of "${item.name}" will be the open system ("${actions.current().name}"), which gets linked to it.`,
      confirmLabel: 'Continue',
    });
    if (ok) void showUpdate(item.id, item.name, item.version);
  }

  // ---- Publishing --------------------------------------------------------------------------

  function animationChoice(animated: boolean, initial = animated) {
    const select = h(
      'select',
      { class: 'community-select community-display-mode', disabled: !animated },
      animated ? h('option', { value: 'animated', text: 'Animated' }) : null,
      h('option', { value: 'static', text: 'Static' }),
    );
    select.value = animated && initial ? 'animated' : 'static';
    return {
      element: h('label', { class: 'community-field' }, h('span', { text: 'Display as' }), select),
      animated: () => select.value === 'animated',
    };
  }

  /** Thumbnail block with "Edit preview…": keeps the chosen images in `state.media`. */
  function previewPicker(
    state: { media: PreviewResult | null },
    framing?: PreviewFraming,
    published?: CommunitySystem,
    render: CommunityActions['preview'] = actions.preview,
  ) {
    const img = h('img', { alt: '' });
    if (published?.thumb) img.src = published.thumb;
    const box = h(
      'div',
      { class: 'community-detail-thumb' },
      published ? (published.thumb ? img : null) : message('Rendering the preview…'),
    );
    const show = (m: PreviewResult) => {
      state.media = m;
      img.src = m.thumb;
      box.replaceChildren(
        img,
        ...(m.previewFrames
          ? [h('span', { class: 'community-kind-badge', title: 'Animated' }, icon('film', 11))]
          : []),
      );
    };
    const edit = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-small',
        onclick: async () => {
          edit.disabled = true;
          try {
            const current = state.media?.framing ?? framing;
            const media = published
              ? await actions.editPublishedPreview(published, current)
              : await render(true, current);
            if (media) show(media);
          } catch (e) {
            toast(errorText(e), 'error');
          } finally {
            edit.disabled = false;
          }
        },
      },
      icon('tune', 12),
      'Edit preview…',
    );
    if (!published)
      void render(false, framing)
        .then((m) => {
          if (m && !state.media) show(m);
        })
        .catch((e: unknown) => box.replaceChildren(message(errorText(e))));
    return h('div', { class: 'community-preview-picker' }, box, edit);
  }

  function tagEditor(initial: readonly string[], type: PublicationKind) {
    const limit = 8;
    let selected = [...initial];
    let request = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const chips = h('div', { class: 'community-tag-chips' });
    const input = h('input', {
      type: 'text',
      class: 'dialog-text',
      placeholder: 'Add a tag…',
      'aria-label': 'Tags',
      autocomplete: 'off',
    });
    const suggestions = h('div', { class: 'community-tag-suggestions' });
    const status = h('span', { class: 'community-tag-status', role: 'status', hidden: true });
    const renderChips = () => {
      input.disabled = selected.length >= limit;
      input.placeholder = input.disabled ? '8 tags maximum' : 'Add a tag…';
      chips.replaceChildren(
        ...selected.map((tag) =>
          h(
            'button',
            {
              type: 'button',
              class: 'community-tag community-tag-chip',
              'aria-label': `Remove tag ${tag}`,
              onclick: () => {
                selected = selected.filter((value) => value !== tag);
                renderChips();
                input.focus();
                suggest();
              },
            },
            tag,
            icon('close', 10),
          ),
        ),
      );
    };
    const add = (text: string) => {
      const tag = text
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\- ]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 24);
      if (!tag || selected.length >= limit) return;
      if (!selected.includes(tag)) selected.push(tag);
      input.value = '';
      renderChips();
      if (!input.disabled) input.focus();
      suggest();
    };
    const suggest = () => {
      clearTimeout(timer);
      const token = ++request;
      status.hidden = true;
      suggestions.replaceChildren();
      if (input.disabled) return;
      const query = input.value.trim();
      const exclude = [...selected];
      timer = setTimeout(() => {
        if (!input.isConnected) return;
        void community
          .suggestTags(query, exclude, type)
          .then((matches) => {
            if (token !== request || !input.isConnected) return;
            suggestions.replaceChildren(
              ...matches
                .filter(({ tag }) => !selected.includes(tag))
                .map(({ tag, count }) =>
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'community-tag',
                      title: `Used by ${count} publications`,
                      onclick: () => add(tag),
                    },
                    tag,
                    h('span', { class: 'community-tag-count', text: count.toLocaleString() }),
                  ),
                ),
            );
          })
          .catch(() => {
            if (token !== request || !input.isConnected) return;
            status.textContent = 'Tag suggestions are unavailable.';
            status.hidden = false;
          });
      }, 150);
    };
    input.addEventListener('focus', suggest);
    input.addEventListener('input', suggest);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      add(input.value);
    });
    renderChips();
    return {
      element: h(
        'div',
        { class: 'community-field' },
        h('span', { text: 'Tags' }),
        chips,
        input,
        suggestions,
        status,
      ),
      values: () => [...selected],
    };
  }

  function form(
    title: string,
    initial: PublishFields,
    side: HTMLElement,
    submitLabel: string,
    submit: (fields: PublishFields) => Promise<void>,
    back: () => void,
    display?: HTMLElement,
    hint: HTMLElement | null = null,
  ): void {
    bar.hidden = true;
    const name = h('input', { type: 'text', class: 'dialog-text', maxLength: 64, required: true });
    name.value = initial.name;
    const category = h(
      'select',
      { class: 'community-select' },
      ...categories.map((c) => h('option', { value: c.id, text: c.label })),
    );
    category.value = initial.category || categories[categories.length - 1]?.id || 'other';
    const tags = tagEditor(initial.tags, query.type);
    const description = h('textarea', {
      class: 'dialog-text community-textarea',
      maxLength: 2000,
      placeholder: nodes()
        ? 'What it does, its inputs and parameters'
        : 'What it is, how to use it',
    });
    description.value = initial.description;
    const submitBtn = h('button', { type: 'submit', class: 'btn btn-primary', text: submitLabel });
    const field = (text: string, control: HTMLElement) =>
      h('label', { class: 'community-field' }, h('span', { text }), control);
    const el = h(
      'form',
      {
        class: 'community-form',
        onsubmit: (e: Event) => {
          e.preventDefault();
          submitBtn.disabled = true;
          void submit({
            name: name.value.trim(),
            category: category.value,
            tags: tags.values(),
            description: description.value.trim(),
          })
            .catch((err: unknown) => toast(errorText(err), 'error'))
            .finally(() => {
              submitBtn.disabled = false;
            });
        },
      },
      h('h3', { text: title }),
      h(
        'div',
        { class: 'community-detail-main' },
        side,
        h(
          'div',
          { class: 'community-detail-info' },
          field('Name', name),
          field('Category', category),
          display,
          tags.element,
          field('Description', description),
          hint,
          h('p', {
            class: 'community-meta community-licence',
            text: 'Everything published to the community can be reused freely by anyone, in any project.',
          }),
        ),
      ),
      h(
        'div',
        { class: 'community-form-footer' },
        h('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: back }),
        submitBtn,
      ),
    );
    body.replaceChildren(el);
    name.focus();
  }

  async function showPublish(): Promise<void> {
    if (!requireAccount('publish')) return;
    const current = actions.current();
    if (current.link) {
      void showUpdate();
      return;
    }
    if (!(await ensureCategories())) return;
    const state: { media: PreviewResult | null } = { media: null };
    const display = animationChoice(current.animated);
    form(
      opts.libraryPublish ? `Publish "${current.name}"` : 'Publish the open system',
      { name: current.name, category: '', tags: [], description: '' },
      previewPicker(state),
      'Publish',
      async (fields) => {
        if (!state.media) throw new Error('The preview is still rendering');
        const id = await actions.publishCurrent(fields, state.media, display.animated());
        toast(`Published "${fields.name}"`);
        query.scope = 'mine';
        renderTabs();
        void showDetail(id);
      },
      () => void load(),
      display.element,
      unpublishedNodesHint(),
    );
  }

  /**
   * Publishing a system never publishes the shader nodes inside it: when some of your
   * published nodes have unpublished changes, say so, with a shortcut to each node's update.
   */
  function unpublishedNodesHint(): HTMLElement | null {
    const list = actions.nodes.unpublished();
    if (!list.length) return null;
    return h(
      'div',
      { class: 'community-node-hint' },
      h('p', {
        text:
          list.length === 1
            ? 'This system contains one of your shader nodes with unpublished changes. The ' +
              'system keeps them, but people who installed the node only get them from a node update:'
            : `This system contains ${list.length} of your shader nodes with unpublished ` +
              'changes. The system keeps them, but people who installed those nodes only get ' +
              'them from node updates:',
      }),
      h(
        'div',
        { class: 'community-actions' },
        ...list.map(({ nodeId, link }) =>
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-small',
              title: 'Select this node and publish its update',
              onclick: () => {
                actions.nodes.select(nodeId);
                void showUpdate(link.id, link.name, link.version ?? undefined, true);
              },
            },
            icon('download', 12),
            `Update "${link.name}"…`,
          ),
        ),
      ),
    );
  }

  /** Form publishing the selected custom shader node as a new community node. */
  async function showPublishNode(): Promise<void> {
    if (!requireAccount('publish')) return;
    const current = actions.nodes.current();
    if (current.link) {
      void showUpdate(current.link.id, current.link.name, current.link.version ?? undefined, true);
      return;
    }
    if (!current.publishable) {
      toast('Select a custom shader node (edited code or its own parameters) to publish it');
      return;
    }
    if (!(await ensureCategories())) return;
    const state: { media: PreviewResult | null } = { media: null };
    const display = animationChoice(current.animated);
    form(
      `Publish the node "${current.name}"`,
      { name: current.name, category: '', tags: [], description: '' },
      previewPicker(state, undefined, undefined, actions.nodes.preview),
      'Publish',
      async (fields) => {
        if (!state.media) throw new Error('The preview is still rendering');
        const id = await actions.nodes.publish(fields, state.media, display.animated());
        toast(`Published "${fields.name}"`);
        query.scope = 'mine';
        renderTabs();
        void showDetail(id);
      },
      () => void load(),
      display.element,
    );
  }

  /**
   * Small window publishing the open system (or, with `node`, the selected node) as the next
   * version of `id` (default: the community system it is linked to), with its preview (last
   * framing, editable).
   */
  async function showUpdate(
    id?: string,
    name?: string,
    version?: number,
    node = false,
  ): Promise<void> {
    if (!requireAccount('publish')) return;
    const current = node ? { ...actions.nodes.current(), link: null } : actions.current();
    const target = id ?? current.link?.id;
    if (!target) return;
    const state: { media: PreviewResult | null } = { media: null };
    const popup = h('dialog', {
      class: 'dialog community-update',
      'aria-label': 'Publish an update',
    });
    const publish = h('button', {
      type: 'button',
      class: 'btn btn-primary',
      text: 'Publish update',
    });
    const v = publicationVersion(version ?? current.link?.version);
    const display = animationChoice(current.animated);
    popup.append(
      h('h2', { text: 'Publish an update' }),
      h(
        'div',
        { class: 'community-update-body' },
        previewPicker(
          state,
          id ? undefined : (current.link?.framing ?? undefined),
          undefined,
          node ? actions.nodes.preview : actions.preview,
        ),
        h(
          'div',
          { class: 'community-update-info' },
          h('span', {
            class: 'community-update-label',
            text: node ? 'Community shader node' : 'Community system',
          }),
          h('h3', { class: 'community-update-name', text: name ?? current.name }),
          h(
            'div',
            {
              class: 'community-update-version',
              'aria-label':
                v === null ? 'Publish the next version' : `Version ${v} to version ${v + 1}`,
            },
            h('span', { text: v === null ? 'Published' : `v${v}` }),
            h('span', { text: '→', 'aria-hidden': 'true' }),
            h('strong', { text: v === null ? 'Next version' : `v${v + 1}` }),
          ),
          h('p', {
            class: 'community-meta',
            text: node
              ? 'Replaces the published version. Systems already using it keep their copy; ' +
                'people who installed it are offered the update.'
              : 'Replaces the published version. Subscribers will see the update.',
          }),
          display.element,
          node ? null : unpublishedNodesHint(),
        ),
      ),
      h(
        'div',
        { class: 'dialog-buttons' },
        h('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: () => popup.close() }),
        publish,
      ),
    );
    publish.addEventListener('click', () => {
      if (!state.media) {
        toast('The preview is still rendering');
        return;
      }
      publish.disabled = true;
      void (node ? actions.nodes.publishUpdate : actions.publishUpdate)(
        state.media,
        target,
        display.animated(),
      )
        .then((n) => {
          popup.close();
          toast(n === null ? 'Update published' : `Published version ${n}`);
          void showDetail(target);
        })
        .catch(async (e: unknown) => {
          // A write can return 404 for the wrong account; confirm deletion with a public read.
          let deleted = false;
          if ((e as { status?: number }).status === 404) {
            try {
              await community.get(target);
            } catch (lookupError) {
              deleted = isMissing(lookupError);
            }
          }
          if (deleted) {
            actions.forget(target);
            popup.close();
            toast(
              node
                ? 'This node is not online any more'
                : 'This system is not online any more: it is local again',
              'error',
            );
            renderPublishButton();
            return;
          }
          toast(errorText(e), 'error');
        })
        .finally(() => {
          publish.disabled = false;
        });
    });
    popup.addEventListener('close', () => popup.remove());
    dialog.append(popup);
    popup.showModal();
  }

  async function showEdit(item: CommunitySystem): Promise<void> {
    if (!(await ensureCategories())) return;
    const display = animationChoice(actions.canAnimate(item), item.animated);
    const preview: { media: PreviewResult | null } = { media: null };
    form(
      `Edit "${item.name}"`,
      {
        name: item.name,
        category: item.category,
        tags: item.tags,
        description: item.description,
      },
      previewPicker(preview, undefined, item),
      'Save',
      async (fields) => {
        await actions.editPublication(item, fields, display.animated(), preview.media);
        toast('Saved');
        void showDetail(item.id);
      },
      () => void showDetail(item.id),
      display.element,
    );
  }

  async function showEditById(id: string): Promise<void> {
    try {
      await showEdit(await community.get(id));
    } catch (e) {
      if (isMissing(e)) actions.forget(id);
      body.replaceChildren(message(errorText(e)));
    }
  }

  // ---- Window ------------------------------------------------------------------------------

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query.q = search.value.trim();
      void load();
    }, 300);
  });
  sortSelect.addEventListener('change', () => {
    query.sort = sortSelect.value as CommunitySort;
    void load();
  });
  categorySelect.addEventListener('change', () => {
    query.category = categorySelect.value;
    void load();
  });

  dialog.append(
    h(
      'div',
      { class: 'library-head' },
      h('h2', { text: 'Community' }),
      typeTabs.element,
      publishArea,
      h('div', { class: 'search-box' }, icon('search', 14), search),
      h(
        'button',
        {
          type: 'button',
          class: 'panel-close',
          title: 'Close',
          'aria-label': 'Close',
          onclick: close,
        },
        icon('close', 12),
      ),
    ),
    bar,
    body,
  );
  dialog.addEventListener('close', () => {
    dialog.remove();
    actions.closed?.();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  document.body.append(dialog);
  updatePlaceholder();
  renderTabs();
  renderPublishButton();
  dialog.showModal();
  // Moderators get the review queue.
  if (actions.signedIn())
    void community.isModerator().then((moderator) => {
      if (!moderator || !dialog.isConnected) return;
      bar.append(
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-small community-moderation',
            title: 'Reported and hidden publications',
            onclick: () => void showModeration(),
          },
          icon('details', 12),
          'Moderation',
        ),
      );
    });
  void ensureCategories();
  if (opts.edit) void showEditById(opts.edit);
  else if (opts.view) void showDetail(opts.view);
  else if (opts.publishNode) void showPublishNode();
  else if (opts.publish) void showPublish();
  else void load();
}
