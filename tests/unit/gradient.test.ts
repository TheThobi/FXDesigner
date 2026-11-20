import { describe, expect, it } from 'vitest';
import {
  bakeGradient,
  gradient,
  gradientKey,
  reverseGradient,
  sampleGradient,
} from '../../src/params/gradient';

const bw = gradient(['#000000', 0], ['#ffffff', 1]);

describe('sampleGradient', () => {
  it('interpolates linearly between stops', () => {
    const [r, g, b, a] = sampleGradient(bw, 0.5);
    expect(r).toBeCloseTo(0.5);
    expect(g).toBeCloseTo(0.5);
    expect(b).toBeCloseTo(0.5);
    expect(a).toBe(1);
  });

  it('clamps outside the stop range', () => {
    const g = gradient(['#ff0000', 0.25], ['#0000ff', 0.75]);
    expect(sampleGradient(g, 0)).toEqual([1, 0, 0, 1]);
    expect(sampleGradient(g, 1)).toEqual([0, 0, 1, 1]);
  });

  it('handles unsorted stops', () => {
    const g = gradient(['#ffffff', 1], ['#000000', 0]);
    expect(sampleGradient(g, 0)[0]).toBe(0);
  });

  it('interpolates alpha', () => {
    const g = gradient(['#ffffff', 0, 0], ['#ffffff', 1, 1]);
    expect(sampleGradient(g, 0.25)[3]).toBeCloseTo(0.25);
  });
});

describe('bakeGradient', () => {
  it('produces width*4 bytes with exact endpoints', () => {
    const data = bakeGradient(bw, 256);
    expect(data).toHaveLength(1024);
    expect([...data.slice(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...data.slice(1020)]).toEqual([255, 255, 255, 255]);
  });
});

describe('gradientKey / reverse', () => {
  it('is order independent and changes with content', () => {
    expect(gradientKey(bw)).toBe(gradientKey(gradient(['#ffffff', 1], ['#000000', 0])));
    expect(gradientKey(bw)).not.toBe(gradientKey(reverseGradient(bw)));
  });
});
