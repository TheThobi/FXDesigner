import { describe, expect, it } from 'vitest';
import { encodeGif } from '../../src/util/gif';

/** Minimal GIF decoder (global palette, full-frame images): frames as palette indices. */
function decode(bytes: Uint8Array): {
  width: number;
  height: number;
  palette: number[][];
  frames: Uint8Array[];
} {
  let p = 0;
  const u8 = () => bytes[p++]!;
  const u16 = () => u8() | (u8() << 8);
  expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a');
  p = 6;
  const width = u16();
  const height = u16();
  const flags = u8();
  p += 2;
  const size = 2 << (flags & 7);
  const palette: number[][] = [];
  for (let i = 0; i < size; i++) palette.push([u8(), u8(), u8()]);
  const frames: Uint8Array[] = [];
  const subBlocks = () => {
    const data: number[] = [];
    for (let n = u8(); n > 0; n = u8()) for (let i = 0; i < n; i++) data.push(u8());
    return data;
  };
  for (;;) {
    const tag = u8();
    if (tag === 0x3b) break;
    if (tag === 0x21) {
      u8();
      subBlocks();
      continue;
    }
    expect(tag).toBe(0x2c);
    p += 9;
    const minCode = u8();
    const data = subBlocks();
    // LZW decode.
    const clear = 1 << minCode;
    let codeSize = minCode + 1;
    let dict: number[][] = [];
    const reset = () => {
      dict = [];
      for (let i = 0; i < clear; i++) dict.push([i]);
      dict.push([], []);
      codeSize = minCode + 1;
    };
    reset();
    const out: number[] = [];
    let bit = 0;
    let prev: number[] | null = null;
    for (;;) {
      let code = 0;
      for (let i = 0; i < codeSize; i++, bit++) code |= ((data[bit >> 3]! >> (bit & 7)) & 1) << i;
      if (code === clear) {
        reset();
        prev = null;
        continue;
      }
      if (code === clear + 1) break;
      const entry: number[] = code < dict.length ? dict[code]! : [...prev!, prev![0]!];
      out.push(...entry);
      if (prev) dict.push([...prev, entry[0]!]);
      prev = entry;
      if (dict.length === 1 << codeSize && codeSize < 12) codeSize++;
    }
    frames.push(Uint8Array.from(out));
  }
  return { width, height, palette, frames };
}

describe('encodeGif', () => {
  it('round-trips frames through a GIF decoder (palette, transparency, LZW)', () => {
    const w = 37;
    const hgt = 23;
    const frames = [0, 1, 2].map((f) => {
      const px = new Uint8ClampedArray(w * hgt * 4);
      for (let i = 0; i < w * hgt; i++) {
        const x = i % w;
        const y = Math.floor(i / w);
        px[i * 4] = (x * 7 + f * 40) & 255;
        px[i * 4 + 1] = (y * 11) & 255;
        px[i * 4 + 2] = ((x ^ y) * 5) & 255;
        px[i * 4 + 3] = (x + y + f) % 9 === 0 ? 0 : 255;
      }
      return px;
    });
    const gif = decode(encodeGif(frames, w, hgt, 4));
    expect([gif.width, gif.height, gif.frames.length]).toEqual([w, hgt, 3]);
    frames.forEach((px, f) => {
      const indices = gif.frames[f]!;
      expect(indices.length).toBe(w * hgt);
      for (let i = 0; i < w * hgt; i++) {
        if (px[i * 4 + 3] === 0) {
          expect(indices[i]).toBe(0);
          continue;
        }
        expect(indices[i]).toBeGreaterThan(0);
        const c = gif.palette[indices[i]!]!;
        // Quantization error stays small (few distinct colors here).
        for (let k = 0; k < 3; k++) expect(Math.abs(c[k]! - px[i * 4 + k]!)).toBeLessThan(48);
      }
    });
  });

  it('handles long runs past the 4096-entry dictionary (clear codes)', () => {
    const w = 256;
    const hgt = 256;
    const px = new Uint8ClampedArray(w * hgt * 4);
    for (let i = 0; i < w * hgt; i++) {
      px[i * 4] = (i * 2654435761) >>> 24;
      px[i * 4 + 1] = (i * 40503) & 255;
      px[i * 4 + 2] = i & 255;
      px[i * 4 + 3] = 255;
    }
    const gif = decode(encodeGif([px], w, hgt, 4));
    expect(gif.frames[0]!.length).toBe(w * hgt);
  });
});
