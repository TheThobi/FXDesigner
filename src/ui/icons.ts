/** Circles as an SVG path (each: cx, cy, r). */
function circles(list: readonly (readonly [number, number, number])[]): string {
  return list
    .map(([x, y, r]) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`)
    .join('');
}

/** Inline SVG icon set (24x24, Material-style paths). Static strings only. */
const PATHS = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
  restart: 'M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z',
  undo: 'M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62A7.95 7.95 0 0 1 20.5 16l2.36-.78A10.5 10.5 0 0 0 12.5 8z',
  redo: 'M18.4 10.6A10.46 10.46 0 0 0 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16a7.95 7.95 0 0 1 12.72-3.62L13 16h9V7z',
  open: 'M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8z',
  save: 'M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10z',
  link: 'M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8zm9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4.5-4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm4.5-4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-9 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2z',
  film: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4z',
  grid: 'M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z',
  search:
    'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  reset:
    'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
  close:
    'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  swap: 'M6.99 11 3 15l3.99 4v-3H14v-2H6.99zM21 9l-3.99-4v3H10v2h7.01v3z',
  texture:
    'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM5 19l3.5-4.5 2.5 3 3.5-4.5 4.5 6z',
  details: 'M3 5h18v2H3zm0 6h18v2H3zm0 6h12v2H3z',
  viewport:
    'M21 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5v2h8v-2h5a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 14H3V5h18z',
  palette:
    'M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  tune: 'M3 17v2h6v-2zM3 5v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z',
  brush:
    'M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37-1.34-1.34a1 1 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a1 1 0 0 0 0-1.41z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.22 5.64l1.42-1.42 2.12 2.12-1.42 1.42zm12.02 12.02 1.42-1.42 2.12 2.12-1.42 1.42zM16.24 6.34l2.12-2.12 1.42 1.42-2.12 2.12zM4.22 18.36l2.12-2.12 1.42 1.42-2.12 2.12z',
  posterize: 'M3 21v-6h5v6zm6.5 0V10h5v11zM16 21V4h5v17z',
  halftone: circles([
    [5, 5, 2.6],
    [12, 5, 2],
    [19, 5, 1.4],
    [5, 12, 2],
    [12, 12, 1.4],
    [19, 12, 0.9],
    [5, 19, 1.4],
    [12, 19, 0.9],
    [19, 19, 0.5],
  ]),
  pixelate: 'M3 3h6v6H3zm6 6h6v6H9zm6-6h6v6h-6zM3 15h6v6H3zm12 0h6v6h-6z',
  outline: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z',
  antialias: 'M21 3 3 21h18zM8 3H6v2H4v2H2V3h6z',
  levels: 'M3 21V12l4-5 4 6 4-9 6 17z',
  output: 'M5 20h14v-2H5zm7-17-6 6h4v6h4V9h4z',
  eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  flow: 'M2 8c3-3 6-3 9 0s6 3 9 0l1.5 1.5c-3.75 3.75-7.75 3.75-11.5 0-2.25-2.25-4.75-2.25-7 0zm0 7c3-3 6-3 9 0s6 3 9 0l1.5 1.5c-3.75 3.75-7.75 3.75-11.5 0-2.25-2.25-4.75-2.25-7 0z',
  clock:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3v6l5 3 1-1.6-4-2.4V7z',
  zoomIn: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',
  zoomOut: 'M19 13H5v-2h14z',
  fit: 'M3 5v4h2V5h4V3H5a2 2 0 0 0-2 2zm2 10H3v4a2 2 0 0 0 2 2h4v-2H5zm14 4h-4v2h4a2 2 0 0 0 2-2v-4h-2zm0-16h-4v2h4v4h2V5a2 2 0 0 0-2-2z',
  layout: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z',
  stepBack: 'M6 6h2v12H6zm3.5 6 8.5 6V6z',
  stepForward: 'M6 18l8.5-6L6 6zM16 6v12h2V6z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z',
  chevronDown: 'M7 10l5 5 5-5z',
  kuwahara: 'M3 3h8v8H3zm10 0h8v5h-8zm0 7h8v11h-8zM3 13h8v8H3z',
  drop: 'M12 2c-4 5.5-6.5 9.2-6.5 12.5a6.5 6.5 0 0 0 13 0C18.5 11.2 16 7.5 12 2zm-3 12.5h2a2 2 0 0 0 2 2v2a4 4 0 0 1-4-4z',
  paper: 'M6 2h9l5 5v15H6zm8 1.5V8h4.5zM8 11h10v1.5H8zm0 3.5h10V16H8zm0 3.5h7v1.5H8z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
} as const;

export type IconName = keyof typeof PATHS;

export function isIconName(name: string | undefined): name is IconName {
  return name !== undefined && Object.hasOwn(PATHS, name);
}

export function icon(name: IconName, size = 16): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `icon icon-${name}`;
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="currentColor" fill-rule="evenodd"><path d="${PATHS[name]}"/></svg>`;
  return span;
}
