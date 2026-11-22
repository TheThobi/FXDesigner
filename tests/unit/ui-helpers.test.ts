import { describe, expect, it } from 'vitest';
import { mostUsedNodes } from '../../src/app/nodeUsage';
import { OPERATORS } from '../../src/generators/operators';
import { roundedPolyline } from '../../src/ui/Viewport';
import { parseDockLayout } from '../../src/ui/Dock';
import {
  cmykToRgb,
  hslToRgb,
  hsvToRgb,
  rgbToCmyk,
  rgbToHsl,
  rgbToHsv,
} from '../../src/ui/controls/colorPicker';

describe('link paths', () => {
  it('rounds the corners of an axis-aligned polyline', () => {
    const d = roundedPolyline(
      [
        [0, 0],
        [50, 0],
        [50, 40],
        [100, 40],
      ],
      10,
    );
    expect(d).toBe('M0,0 L40,0 Q50,0 50,10 L50,30 Q50,40 60,40 L100,40');
  });

  it('draws a straight line when the pins are level', () => {
    expect(
      roundedPolyline(
        [
          [0, 5],
          [50, 5],
          [50, 5],
          [100, 5],
        ],
        10,
      ),
    ).toBe('M0,5 L100,5');
  });
});

describe('quick-add suggestions', () => {
  it('puts the most used first, then the default operators', () => {
    const ids = mostUsedNodes(OPERATORS, { 'op-dissolve': 3, 'op-scroll': 1 }).map((d) => d.id);
    expect(ids.slice(0, 3)).toEqual(['op-dissolve', 'op-scroll', 'op-blend']);
    expect(ids.length).toBe(8);
  });
});

describe('dock layout', () => {
  it('keeps valid layouts and drops duplicates or unknown panels', () => {
    const layout = parseDockLayout({
      kind: 'split',
      dir: 'row',
      sizes: [1, 2],
      children: [
        { kind: 'stack', panels: ['browser', 'details', 'nope'], active: 'details' },
        {
          kind: 'split',
          dir: 'column',
          sizes: [3, 1],
          children: [
            { kind: 'stack', panels: ['viewport', 'browser'], active: 'viewport' },
            { kind: 'stack', panels: ['nope'], active: 'nope' },
          ],
        },
      ],
    });
    expect(layout).not.toBeNull();
    const json = JSON.stringify(layout);
    expect(json.match(/browser/g)?.length).toBe(1);
    expect(json).not.toContain('nope');
  });

  it('rejects layouts without the viewport', () => {
    expect(parseDockLayout({ kind: 'stack', panels: ['browser'], active: 'browser' })).toBeNull();
    expect(parseDockLayout('garbage')).toBeNull();
  });
});

describe('color conversions', () => {
  const colors: [number, number, number][] = [
    [1, 0, 0],
    [0.2, 0.6, 0.9],
    [0.5, 0.5, 0.5],
    [0, 0, 0],
    [1, 1, 1],
    [0.93, 0.31, 0.56],
  ];
  const close = (a: readonly number[], b: readonly number[]) =>
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 5));

  it('round-trips through HSV, HSL and CMYK', () => {
    for (const c of colors) {
      close(hsvToRgb(rgbToHsv(c)), c);
      close(hslToRgb(rgbToHsl(c)), c);
      close(cmykToRgb(rgbToCmyk(c)), c);
    }
  });

  it('gives the usual CMYK values', () => {
    close(rgbToCmyk([1, 0, 0]), [0, 1, 1, 0]);
    close(rgbToCmyk([0, 0, 0]), [0, 0, 0, 1]);
  });
});
