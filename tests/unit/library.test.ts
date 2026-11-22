import { beforeEach, describe, expect, it } from 'vitest';
import { UserPresets } from '../../src/app/userPresets';
import { param } from '../../src/params/define';
import { isImageDataUrl, sanitizeValue } from '../../src/params/values';
import { crc32, createZip } from '../../src/util/zip';

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes stored entries with headers and a central directory', () => {
    const data = new TextEncoder().encode('hello');
    const zip = createZip([{ name: 'a.txt', data }]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(18, true)).toBe(5); // compressed size = stored size
    expect(new TextDecoder().decode(zip.subarray(30, 35))).toBe('a.txt');
    expect(new TextDecoder().decode(zip.subarray(35, 40))).toBe('hello');
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(zip.length - 12, true)).toBe(1); // entry count
  });
});

describe('image params', () => {
  const def = param.image('image', 'Image');

  it('accepts base64 images and direct HTTPS URLs', () => {
    expect(isImageDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isImageDataUrl('javascript:alert(1)')).toBe(false);
    expect(sanitizeValue(def, 'https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(sanitizeValue(def, 'http://example.com/a.png')).toBe('');
    expect(sanitizeValue(def, 'https://user:password@example.com/a.png')).toBe('');
    expect(sanitizeValue(def, 'data:image/webp;base64,UklGRg==')).toBe(
      'data:image/webp;base64,UklGRg==',
    );
  });
});

describe('user presets', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  it('saves, renames, replaces and removes per generator, and persists', () => {
    const lib = new UserPresets();
    lib.save('glow', { name: 'A', values: { radius: 0.3 } });
    lib.save('glow', { name: 'B', values: { radius: 0.5 } });
    lib.save('glow', { name: 'A', values: { radius: 0.9 } });
    expect(lib.list('glow').map((p) => p.name)).toEqual(['B', 'A']);
    expect(lib.list('glow')[1]!.values.radius).toBe(0.9);
    lib.rename('glow', 'B', 'Soft');
    expect(new UserPresets().list('glow').map((p) => p.name)).toEqual(['Soft', 'A']);
    lib.remove('glow', 'A');
    expect(new UserPresets().list('glow').map((p) => p.name)).toEqual(['Soft']);
    expect(lib.list('fractal-noise')).toEqual([]);
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem('ptm.userPresets', '{not json');
    expect(new UserPresets().list('glow')).toEqual([]);
  });
});
