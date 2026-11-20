import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import kaleidoscopeFrag from './kaleidoscope.glsl?raw';
import runesFrag from './runes.glsl?raw';
import truchetFrag from './truchet.glsl?raw';

export const runes: ShaderGenerator = {
  kind: 'shader',
  id: 'runes',
  name: 'Rune Glyphs',
  category: 'pattern',
  description: 'Procedural rune glyphs on a seamless grid or around a ring (magic circles, UI).',
  animated: true,
  fragment: runesFrag,
  params: [
    param.select('layout', 'Layout', ['Grid (seamless)', 'Ring'], 0),
    param.int('cells', 'Glyphs', 6, 1, 24),
    param.int('strokes', 'Strokes per glyph', 4, 2, 7),
    param.float('lineWidth', 'Line width', 0.08, 0.02, 0.25),
    param.float('glow', 'Glow', 0.25, 0, 1),
    param.float('ringRadius', 'Ring radius', 0.7, 0.3, 0.9),
    param.float('flicker', 'Flicker', 0, 0, 1),
    param.speed(1, 4),
  ],
  presets: [
    { name: 'Rune ring', values: { layout: 1, cells: 8, strokes: 4, glow: 0.4 } },
    {
      name: 'Ancient tablet',
      values: { layout: 0, cells: 8, strokes: 5, lineWidth: 0.1, glow: 0 },
    },
    {
      name: 'Flickering sigils',
      values: { layout: 0, cells: 4, strokes: 3, glow: 0.7, flicker: 0.8 },
    },
  ],
  featuredPreset: 'Rune ring',
};

export const truchet: ShaderGenerator = {
  kind: 'shader',
  id: 'truchet',
  name: 'Truchet',
  category: 'pattern',
  description: 'Truchet tiles (arcs, diagonals, triangles) forming maze-like seamless patterns.',
  animated: true,
  fragment: truchetFrag,
  params: [
    param.select('mode', 'Tiles', ['Quarter arcs', 'Diagonals', 'Triangles'], 0),
    param.int('cells', 'Tiles', 8, 2, 48),
    param.float('lineWidth', 'Line width', 0.15, 0.01, 0.6),
    param.float('softness', 'Softness', 0, 0, 0.3),
    param.bool('fill', 'Fill regions', false),
    param.speed(0, 2),
  ],
  presets: [
    { name: 'Maze arcs', values: { mode: 0, cells: 12, lineWidth: 0.12 } },
    { name: 'Filled waves', values: { mode: 0, cells: 6, fill: true, lineWidth: 0.04 } },
    { name: 'Triangle mosaic', values: { mode: 2, cells: 10, fill: true } },
    { name: 'Diagonal maze', values: { mode: 1, cells: 16, lineWidth: 0.2 } },
  ],
  featuredPreset: 'Filled waves',
};

export const kaleidoscope: ShaderGenerator = {
  kind: 'shader',
  id: 'kaleidoscope',
  name: 'Kaleidoscope',
  category: 'pattern',
  description: 'Mirrors a noise, cell or ring pattern into symmetric wedges (mandala-like).',
  animated: true,
  fragment: kaleidoscopeFrag,
  params: [
    param.int('segments', 'Segments', 6, 2, 24),
    param.select('pattern', 'Source', ['Noise', 'Cells', 'Rings'], 1),
    param.float('zoom', 'Zoom', 2, 0.5, 8),
    param.float('twist', 'Twist', 0, -6, 6),
    param.float('circular', 'Circular mask', 1, 0, 1),
    param.angle('rotation', 'Rotation', 0),
    param.speed(0.3, 2),
  ],
  presets: [
    { name: 'Mandala cells', values: { segments: 8, pattern: 1, zoom: 2.5 } },
    { name: 'Twisted rings', values: { segments: 12, pattern: 2, twist: 3 } },
    { name: 'Snowflake', values: { segments: 6, pattern: 0, zoom: 4, circular: 1 } },
  ],
  featuredPreset: 'Mandala cells',
};

export const MORE_PATTERNS = [runes, truchet, kaleidoscope];
