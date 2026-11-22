import { describe, expect, it } from 'vitest';
import { mostUsedNodes } from '../../src/app/nodeUsage';
import { OPERATORS } from '../../src/generators/operators';
import { roundedPolyline } from '../../src/ui/Viewport';

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
