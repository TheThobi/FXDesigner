/**
 * Pictograms of the simulations, shown on their browser tile until a real thumbnail exists
 * (simulations are captured from their live preview, after they ran for a while). Stroked
 * line art on a 48×48 grid; static strings only.
 */
const GLYPHS: Readonly<Record<string, string>> = {
  // Turing spots.
  'reaction-diffusion':
    '<g fill="currentColor" stroke="none"><circle cx="11" cy="11" r="4"/><circle cx="25" cy="9" r="3"/><circle cx="38" cy="12" r="4.5"/><circle cx="18" cy="22" r="5"/><circle cx="32" cy="24" r="3.5"/><circle cx="9" cy="33" r="3.5"/><circle cx="23" cy="36" r="4"/><circle cx="37" cy="37" r="5"/><circle cx="42" cy="25" r="2"/><circle cx="30" cy="16" r="1.6"/></g>',
  // Flow arrows.
  'flowmap-painter':
    '<path d="M8 16c10-6 22 6 32 0M8 28c10-6 22 6 32 0M8 40c10-6 22 6 32 0"/><path d="M36 12l4 4-4 4M36 24l4 4-4 4M36 36l4 4-4 4"/>',
  // Branching veins of the slime mold.
  physarum:
    '<path d="M24 42c0-8-4-12-9-17S8 14 7 8M24 42c1-9 6-13 11-18s6-10 6-16M15 25c5-1 8 1 12-3s4-9 3-14M35 24c-4 2-6 6-5 10M12 15c4 0 6 2 8 6M27 22c-4 1-7 5-6 10"/><g fill="currentColor" stroke="none"><circle cx="7" cy="8" r="2.4"/><circle cx="41" cy="8" r="2.4"/><circle cx="30" cy="8" r="2"/><circle cx="24" cy="42" r="2.6"/></g>',
  // Combed ebru (chevrons pulled through the ink bands).
  marbling:
    '<path d="M6 10c8 0 12 2 18 8 6-6 10-8 18-8M6 18c8 0 12 3 18 10 6-7 10-10 18-10M6 26c8 0 12 4 18 12 6-8 10-12 18-12M6 34c8 0 12 3 18 9 6-6 10-9 18-9"/>',
  // Rotating double spiral wave.
  'cyclic-automaton':
    '<path d="M24 24c0-7 9-7 11-2 5 9-6 18-15 13-11-6-9-22 4-24 11-2 20 6 20 15"/><path d="M24 24c0 7-9 7-11 2-5-9 6-18 15-13 11 6 9 22-4 24-11 2-20-6-20-15"/>',
  // Belousov–Zhabotinsky target rings.
  'bz-reaction':
    '<circle cx="17" cy="19" r="2.5"/><circle cx="17" cy="19" r="8"/><circle cx="17" cy="19" r="13.5"/><path d="M33.5 26.6A8 8 0 1 1 30 37M36 33.5a2.5 2.5 0 1 0 .01 0"/>',
  // Orbium creature (ring glider).
  lenia:
    '<path d="M24 6c11 0 18 8 18 18s-8 18-18 18S6 35 6 24 13 6 24 6zm3 10c-6 0-10 4-10 9s3 8 9 8 9-4 9-9-3-8-8-8z" fill="currentColor" fill-opacity="0.25" fill-rule="evenodd"/>',
  // Curling waves (Kelvin–Helmholtz rolls).
  fluid:
    '<path d="M3 32c7 0 9-13 17-13 6 0 8 7 3 10-4 2-7-2-4-5M23 32c7 0 9-13 17-13 6 0 8 7 3 10-4 2-7-2-4-5"/><path d="M3 40h42"/>',
  // Dendrite / snowflake.
  'crystal-growth':
    '<path d="M24 6v36M8.4 15l31.2 18M8.4 33l31.2-18M24 12l-4-4m4 4 4-4M24 36l-4 4m4-4 4 4M13 18l-5 0m5 0-2-5M35 30l5 0m-5 0 2 5M13 30l-5 0m5 0-2 5M35 18l5 0m-5 0 2-5"/>',
  // Light net under water.
  'caustics-sim':
    '<path d="M6 14c6 4 10-4 16 0s10 6 20 0M6 26c8-6 12 6 18 0s12 2 18-2M6 38c6-4 12 4 18 0s12-6 18 0M14 8c-4 8 4 14 0 22s2 12 0 14M32 8c4 8-4 14 0 22s-2 12 0 14"/>',
  // Mountain carved by a river.
  erosion: '<path d="M4 40 18 14l8 12 6-8 12 22z"/><path d="M18 14c2 8-4 12 0 18s6 4 4 8"/>',
  // Folded meander (brain coral).
  'differential-growth':
    '<path d="M8 10c5-3 9 3 14 0s9-3 14 0c4 2 4 7 0 8-5 2-9-3-14 0s-9 3-12 1c-4-2-5 6 0 7 5 2 9-3 14 0s9 3 14 0c4-1 5 6 0 8-5 2-9-3-14 0s-9 3-14 0"/>',
  // Flame with rising smoke.
  'smoke-fire':
    '<path d="M24 44c-7 0-11-5-10-11 1-6 6-8 6-14 4 3 5 7 5 10 2-2 2-5 1-8 6 4 9 9 8 14-1 6-4 9-10 9z"/><path d="M24 44c-3 0-4-3-3-5s3-3 3-6c2 2 3 4 3 6 0 3-1 5-3 5z"/><path d="M27 15c-4-3 2-6-1-10M21 13c-3-2 1-4-1-7"/>',
  // Brush stroke.
  'paint-mask':
    '<path d="M10 36c4 0 6-2 6-5s3-5 6-3-1 8-6 9-8 1-6-1z"/><path d="M20 28 38 10l2 2-16 18"/>',
  // Glider on a grid.
  'life-automata':
    '<path d="M8 8h32v32H8zM18.7 8v32M29.3 8v32M8 18.7h32M8 29.3h32"/><path d="M21 11h5v5h-5zM31 21h5v5h-5zM11 32h5v5h-5zM21 32h5v5h-5zM31 32h5v5h-5z" fill="currentColor"/>',
};

/** Pictogram of simulation `id` (an SVG element), or null when it has none. */
export function simGlyph(id: string): HTMLSpanElement | null {
  const body = GLYPHS[id];
  if (!body) return null;
  const span = document.createElement('span');
  span.className = 'sim-glyph';
  span.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  return span;
}
