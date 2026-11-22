/**
 * Minimal 16-bit grayscale PNG encoder (height maps without 8-bit banding). The canvas API only
 * writes 8-bit PNGs; IDAT is compressed with the browser's zlib CompressionStream.
 */
import { crc32 } from './zip';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Raw scanlines (filter byte 0, big-endian 16-bit samples) of top-down values in [0, 1]. */
export function gray16Scanlines(values: Float32Array, width: number, height: number): Uint8Array {
  const stride = 1 + width * 2;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    for (let x = 0; x < width; x++) {
      const v = values[y * width + x]!;
      const q = Math.round(Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0)) * 65535);
      raw[row + 1 + x * 2] = q >> 8;
      raw[row + 2 + x * 2] = q & 255;
    }
  }
  return raw;
}

/** Assembles the PNG file from already zlib-compressed scanlines. */
export function assemblePng16(width: number, height: number, idat: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 16; // bit depth
  ihdr[9] = 0; // grayscale
  const parts = [
    new Uint8Array(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function zlib(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 16-bit grayscale PNG of top-down `values` in [0, 1]. */
export async function encodeGray16Png(
  values: Float32Array,
  width: number,
  height: number,
): Promise<Blob> {
  const idat = await zlib(gray16Scanlines(values, width, height));
  return new Blob([assemblePng16(width, height, idat) as Uint8Array<ArrayBuffer>], {
    type: 'image/png',
  });
}
