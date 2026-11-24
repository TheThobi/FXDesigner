/**
 * Animated GIF encoder (GIF89a, looping): one global palette for the whole animation (median
 * cut over a 15-bit color histogram of every frame), index 0 reserved for transparency, LZW
 * compression. Enough for short VFX loops; no dependency.
 */

const TRANSPARENT = 0;
/** Pixels below this alpha become transparent (GIF has 1-bit alpha). */
const ALPHA_CUT = 128;

/** 5 bits per channel. */
const key15 = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

interface Box {
  readonly colors: number[];
}

/** Up to 255 colors from a 15-bit histogram (median cut on the widest channel). */
function buildPalette(histogram: Uint32Array): [number, number, number][] {
  const all: number[] = [];
  for (let k = 0; k < histogram.length; k++) if (histogram[k]! > 0) all.push(k);
  if (all.length === 0) return [[0, 0, 0]];
  const channel = (k: number, c: number) => (k >> (10 - c * 5)) & 31;
  const boxes: Box[] = [{ colors: all }];
  while (boxes.length < 255) {
    // Split the box with the most pixels among those that can still be split.
    let best = -1;
    let bestCount = 0;
    boxes.forEach((box, i) => {
      if (box.colors.length < 2) return;
      let count = 0;
      for (const k of box.colors) count += histogram[k]!;
      if (count > bestCount) {
        bestCount = count;
        best = i;
      }
    });
    if (best < 0) break;
    const box = boxes[best]!;
    let widest = 0;
    let range = -1;
    for (let c = 0; c < 3; c++) {
      let lo = 31;
      let hi = 0;
      for (const k of box.colors) {
        const v = channel(k, c);
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      if (hi - lo > range) {
        range = hi - lo;
        widest = c;
      }
    }
    const sorted = [...box.colors].sort((a, b) => channel(a, widest) - channel(b, widest));
    // Median by pixel count.
    let half = bestCount / 2;
    let cut = 1;
    for (; cut < sorted.length - 1; cut++) {
      half -= histogram[sorted[cut - 1]!]!;
      if (half <= 0) break;
    }
    boxes.splice(best, 1, { colors: sorted.slice(0, cut) }, { colors: sorted.slice(cut) });
  }
  return boxes.map((box) => {
    let n = 0;
    const sum = [0, 0, 0];
    for (const k of box.colors) {
      const w = histogram[k]!;
      n += w;
      for (let c = 0; c < 3; c++) sum[c]! += (channel(k, c) * 8 + 4) * w;
    }
    return [Math.round(sum[0]! / n), Math.round(sum[1]! / n), Math.round(sum[2]! / n)];
  });
}

class ByteWriter {
  private buf = new Uint8Array(1 << 16);
  length = 0;

  byte(b: number): void {
    if (this.length === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.length++] = b & 255;
  }

  word(w: number): void {
    this.byte(w);
    this.byte(w >> 8);
  }

  bytes(list: ArrayLike<number>): void {
    for (let i = 0; i < list.length; i++) this.byte(list[i]!);
  }

  result(): Uint8Array<ArrayBuffer> {
    return this.buf.slice(0, this.length);
  }
}

/** LZW-compresses palette indices into GIF image data sub-blocks. */
function writeLzw(out: ByteWriter, indices: Uint8Array, minCodeSize: number): void {
  out.byte(minCodeSize);
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = end + 1;
  let dict = new Map<number, number>();
  const block: number[] = [];
  let bits = 0;
  let nbits = 0;
  const emit = (code: number) => {
    bits |= code << nbits;
    nbits += codeSize;
    while (nbits >= 8) {
      block.push(bits & 255);
      bits >>>= 8;
      nbits -= 8;
      if (block.length === 255) {
        out.byte(255);
        out.bytes(block);
        block.length = 0;
      }
    }
  };
  emit(clear);
  let prefix = indices[0] ?? 0;
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]!;
    const entry = (prefix << 8) | k;
    const found = dict.get(entry);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(entry, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = new Map();
      codeSize = minCodeSize + 1;
      next = end + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(end);
  if (nbits > 0) block.push(bits & 255);
  if (block.length > 0) {
    out.byte(block.length);
    out.bytes(block);
  }
  out.byte(0);
}

/**
 * Encodes straight RGBA8 frames (top-down rows) as a looping GIF. `delay` is in hundredths
 * of a second per frame (browsers treat values below 2 as 10).
 */
export function encodeGif(
  frames: readonly Uint8ClampedArray[],
  width: number,
  height: number,
  delay: number,
): Uint8Array<ArrayBuffer> {
  const histogram = new Uint32Array(1 << 15);
  for (const f of frames)
    for (let i = 0; i < f.length; i += 4)
      if (f[i + 3]! >= ALPHA_CUT) histogram[key15(f[i]!, f[i + 1]!, f[i + 2]!)]!++;
  const palette = buildPalette(histogram);
  // Nearest palette entry (1-based: 0 is transparent) for every 15-bit color in use.
  const lookup = new Uint8Array(1 << 15);
  for (let k = 0; k < histogram.length; k++) {
    if (histogram[k] === 0) continue;
    const r = ((k >> 10) & 31) * 8 + 4;
    const g = ((k >> 5) & 31) * 8 + 4;
    const b = (k & 31) * 8 + 4;
    let best = 0;
    let bestD = Infinity;
    palette.forEach(([pr, pg, pb], i) => {
      const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    lookup[k] = best + 1;
  }

  const out = new ByteWriter();
  out.bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
  out.word(width);
  out.word(height);
  out.byte(0xf7); // global color table, 8 bits, 256 entries
  out.byte(0);
  out.byte(0);
  for (let i = 0; i < 256; i++) {
    const c = i === TRANSPARENT ? [0, 0, 0] : (palette[i - 1] ?? [0, 0, 0]);
    out.bytes(c);
  }
  // Netscape extension: loop forever.
  out.bytes([0x21, 0xff, 0x0b]);
  out.bytes([...'NETSCAPE2.0'].map((ch) => ch.charCodeAt(0)));
  out.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);

  const indices = new Uint8Array(width * height);
  for (const f of frames) {
    // Graphic control: restore to background (transparent pixels never accumulate), delay.
    out.bytes([0x21, 0xf9, 0x04, 0x09]);
    out.word(delay);
    out.byte(TRANSPARENT);
    out.byte(0);
    for (let p = 0, i = 0; p < indices.length; p++, i += 4)
      indices[p] =
        f[i + 3]! < ALPHA_CUT ? TRANSPARENT : lookup[key15(f[i]!, f[i + 1]!, f[i + 2]!)]!;
    out.byte(0x2c);
    out.word(0);
    out.word(0);
    out.word(width);
    out.word(height);
    out.byte(0);
    writeLzw(out, indices, 8);
  }
  out.byte(0x3b);
  return out.result();
}
