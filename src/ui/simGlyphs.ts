/**
 * Simulation placeholders and the Image source pictogram for browser tiles.
 * Static SVG on a 48x48 grid, with a shared stroke and a four-unit safe area.
 * Silhouettes describe the resulting pattern; subdued fills separate overlapping forms.
 */
const GLYPHS: Readonly<Record<string, string>> = {
  // Sheet with a burnt, glowing corner.
  'burning-paper':
    '<path d="M8 6h18l-3 6 4 4-4 5 4 5-3 5 4 5-2 6H8z"/><path d="M34 40c-6 0-9-4-7-9 1-3 4-4 4-9 3 3 4 6 3 9 2-1 3-3 3-5 4 3 6 7 4 10-1 3-4 4-7 4z"/>',
  // Cracks branching away from an impact.
  'crack-growth':
    '<path d="M24 24 14 16l-4-8M14 16l-8 2M24 24l12-6 6 2M36 18l2-8M24 24l4 12-3 6M28 36l8 4M24 24l-12 8-6 8M12 32l-6-2"/><circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none"/>',
  // Framed landscape identifies an image source before a file is imported.
  image:
    '<rect x="6" y="8" width="36" height="32" rx="3"/><circle cx="16" cy="18" r="3"/><path d="m7 33 10-9 8 7 7-11 10 13v4a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3Z" fill="currentColor" fill-opacity=".18"/>',
  // Organic Turing islands, including a dividing cell.
  'reaction-diffusion':
    '<g fill="currentColor" fill-opacity=".18"><path d="M8 10c3-4 9-3 10 1s-3 5-2 9-3 7-7 5-5-10-1-15Z"/><path d="M28 7c5-3 12 0 12 5s-5 7-9 5-7-7-3-10Z"/><path d="M24 27c4-4 5 2 9 1s8 1 8 5-5 8-9 6-5 3-9 1-3-9 1-13Z"/></g><circle cx="11" cy="36" r="3"/><circle cx="37" cy="22" r="1.5" fill="currentColor" stroke="none"/>',
  // Streamlines with distinct, tangent-aligned arrowheads.
  'flowmap-painter':
    '<path d="M6 12c9-9 21 9 36 0M6 24c9-9 21 9 36 0M6 36c9-9 21 9 36 0"/><path d="m36 10 6 2-2 6m-4 4 6 2-2 6m-4 4 6 2-2 6"/>',
  // Organic branching veins, with thicker trunks and fine connecting trails.
  physarum:
    '<path d="M23 42c2-8-4-12-3-19S29 13 27 6" stroke-width="3"/><path d="M21 29c-8-1-11-7-15-9m14 3c-7-2-6-9-10-14m12 9c7 3 12-2 18-4M23 36c7-2 9-9 17-10M20 23c6 1 8 6 12 6M14 18c-4 0-5-4-8-5m25 5c0-5 4-8 5-12M14 26c-4 2-6 6-8 8m26-5c3 3 3 7 8 9" />',
  // Nested ink folds drawn through an ebru bath.
  marbling:
    '<path d="M6 7c24 0 37 9 22 19S13 39 42 41M6 14c18-3 28 3 18 10S5 38 20 42M6 22c7-5 14-5 10 0S3 32 6 40M28 6c16 5 18 15 8 22s-6 8 6 7M39 7c5 4 5 9 3 13"/>',
  // Three rotating fronts, with space between successive turns.
  'cyclic-automaton':
    '<g><path d="M24 22c-7-7-1-18 9-16 5 1 8 4 9 8M24 22c-3-5 0-10 5-10"/><path d="M24 22c-7-7-1-18 9-16 5 1 8 4 9 8M24 22c-3-5 0-10 5-10" transform="rotate(120 24 24)"/><path d="M24 22c-7-7-1-18 9-16 5 1 8 4 9 8M24 22c-3-5 0-10 5-10" transform="rotate(240 24 24)"/></g>',
  // Expanding chemical wavefronts from two nuclei.
  'bz-reaction':
    '<circle cx="19" cy="20" r="3" fill="currentColor" stroke="none"/><circle cx="19" cy="20" r="8"/><circle cx="19" cy="20" r="14"/><path d="M37 9a20 20 0 0 1 2 19M6 35a20 20 0 0 0 19 4M29 35a7 7 0 0 0 13 2"/><circle cx="36" cy="35" r="2" fill="currentColor" stroke="none"/>',
  // Asymmetric, hollow Orbium with a thick leading edge.
  lenia:
    '<path d="M8 30C2 18 11 6 25 6c12 0 19 9 16 20-2 8-10 16-20 16-6 0-11-5-13-12Zm9-3c2 5 7 7 12 4s7-10 3-13-9-1-12 2-4 5-3 7Z" fill="currentColor" fill-opacity=".22" fill-rule="evenodd"/><path d="M11 21c0-6 5-11 11-11"/>',
  // A rolling vortex fed by two flowing sheets.
  fluid:
    '<path d="M5 34c10 0 10-25 25-25 9 0 14 8 11 15-3 8-15 10-19 3-3-5 1-11 6-10 4 0 6 5 3 7M5 41c17 0 16-11 29-8 4 1 6 0 9-2M5 23c4-1 5-8 8-11"/>',
  // Six dendritic arms, evenly spaced around the growth nucleus.
  'crystal-growth':
    '<g><path d="M24 24V5m0 8-5-4m5 10-7-5m7-1 5-4m-5 10 7-5"/><path d="M24 24V5m0 8-5-4m5 10-7-5m7-1 5-4m-5 10 7-5" transform="rotate(60 24 24)"/><path d="M24 24V5m0 8-5-4m5 10-7-5m7-1 5-4m-5 10 7-5" transform="rotate(120 24 24)"/><path d="M24 24V5m0 8-5-4m5 10-7-5m7-1 5-4m-5 10 7-5" transform="rotate(180 24 24)"/><path d="M24 24V5m0 8-5-4m5 10-7-5m7-1 5-4m-5 10 7-5" transform="rotate(240 24 24)"/><path d="M24 24V5m0 8-5-4m5 10-7-5m7-1 5-4m-5 10 7-5" transform="rotate(300 24 24)"/></g>',
  // Soft intersecting wavefronts form a rippling pool-light pattern.
  'caustics-sim':
    '<path d="M6 13c6-5 10 5 17 1s12-5 19 0M6 29c8-5 12 5 20 1s11-6 16-1M14 6c-4 7 5 12 2 19s-5 12-1 17M33 6c-5 6 3 13 0 20s-5 12-1 16"/>',
  // A terrain block cut by a winding channel, with exposed sediment layers.
  erosion:
    '<path d="m5 23 19-13 19 13-19 13Z" fill="currentColor" fill-opacity=".12"/><path d="M5 23v10l19 11 19-11V23M24 36v8M5 28l13 8m12 2 13-10" stroke-opacity=".65"/><path d="M28 13c-12 3 4 7-4 10s-10 3-10 6M32 16c-8 2 6 6-2 10s-10 3-10 7"/>',
  // A continuous contour buckles into rounded folds.
  'differential-growth':
    '<path d="M8 15c-5-9 8-13 11-5l2 7c2 5 6 3 5-1l-1-5c-1-7 12-7 13 0s-8 10-4 14l5 3c8 6-1 16-7 10l-4-6c-3-4-7-1-4 3 5 8-8 11-10 4l-1-9c0-5-7-2-8-7-1-4 5-4 7-1 4 5 8 0 4-3Z"/>',
  // A swept flame with one inner tongue.
  'smoke-fire':
    '<path d="M25 5c3 12-10 14-8 24-4-2-5-6-5-9-9 12-3 22 12 22 12 0 18-9 13-19-2-4-5-6-6-10 0 6-2 9-5 11 2-7 4-12-1-19Z" fill="currentColor" fill-opacity=".18"/><path d="M24 42c-9-1-8-8 0-15-1 6 8 8 4 14"/>',
  // Brush ferrule and a broad, freshly painted mask.
  'paint-mask':
    '<path d="m20 25 16-18c3-3 8 1 5 4L25 30Z" fill="currentColor" fill-opacity=".18"/><path d="m29 15 6 5M20 25c-9-2-5 11-14 11 6 7 18 4 19-6Z" fill="currentColor" fill-opacity=".18"/><path d="M7 43h33"/>',
  // Five live cells form the canonical glider; empty cells stay quiet.
  'life-automata':
    '<path d="M6 6h36v36H6ZM18 6v36M30 6v36M6 18h36M6 30h36" stroke-opacity=".3"/><g fill="currentColor" stroke="none"><rect x="21" y="9" width="6" height="6" rx="1"/><rect x="33" y="21" width="6" height="6" rx="1"/><rect x="9" y="33" width="6" height="6" rx="1"/><rect x="21" y="33" width="6" height="6" rx="1"/><rect x="33" y="33" width="6" height="6" rx="1"/></g>',
};

/** Browser pictogram of node `id` (an SVG element), or null when it has none. */
export function simGlyph(id: string): HTMLSpanElement | null {
  const body = GLYPHS[id];
  if (!body) return null;
  const span = document.createElement('span');
  span.className = 'sim-glyph';
  span.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  return span;
}
