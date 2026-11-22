import { describe, expect, it } from 'vitest';
import { assemblePng16, gray16Scanlines } from '../../src/util/png16';

describe('16-bit PNG', () => {
  it('writes big-endian 16-bit samples after a filter byte per row', () => {
    const raw = gray16Scanlines(new Float32Array([0, 1, 0.5, -1]), 2, 2);
    expect([...raw]).toEqual([0, 0, 0, 255, 255, 0, 128, 0, 0, 0]);
  });

  it('assembles signature, IHDR (16-bit grayscale), IDAT and IEND', () => {
    const png = assemblePng16(3, 2, new Uint8Array([1, 2, 3]));
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer);
    expect(String.fromCharCode(...png.subarray(12, 16))).toBe('IHDR');
    expect(view.getUint32(16)).toBe(3);
    expect(view.getUint32(20)).toBe(2);
    expect(png[24]).toBe(16);
    expect(png[25]).toBe(0);
    expect(String.fromCharCode(...png.subarray(png.length - 8, png.length - 4))).toBe('IEND');
  });
});
