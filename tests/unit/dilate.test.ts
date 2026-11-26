import { describe, expect, it } from 'vitest';
import { dilatePixels } from '../../src/util/dilate';

describe('dilate', () => {
  it('spreads solid colors under transparent pixels, ring by ring, alpha kept', () => {
    // 5×1: one red solid pixel in the middle.
    const px = new Uint8ClampedArray(5 * 4);
    px.set([255, 0, 0, 255], 2 * 4);
    dilatePixels(px, 5, 1, 1);
    expect([...px.slice(4, 8)]).toEqual([255, 0, 0, 0]);
    expect([...px.slice(12, 16)]).toEqual([255, 0, 0, 0]);
    // Beyond the padding: untouched.
    expect([...px.slice(0, 4)]).toEqual([0, 0, 0, 0]);
    dilatePixels(px, 5, 1, 4);
    expect([...px.slice(0, 4)]).toEqual([255, 0, 0, 0]);
  });

  it('averages neighbours of different colors', () => {
    const px = new Uint8ClampedArray(3 * 4);
    px.set([200, 0, 0, 255], 0);
    px.set([0, 0, 100, 255], 8);
    dilatePixels(px, 3, 1, 1);
    expect([...px.slice(4, 8)]).toEqual([100, 0, 50, 0]);
  });
});
