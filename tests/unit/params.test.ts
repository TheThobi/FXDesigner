import { describe, expect, it } from 'vitest';
import { param } from '../../src/params/define';
import { gradient } from '../../src/params/gradient';
import { defaultValues, sanitizeValue, sanitizeValues } from '../../src/params/values';

const defs = [
  param.float('scale', 'Scale', 4, 1, 32),
  param.int('octaves', 'Octaves', 5, 1, 10),
  param.bool('tileable', 'Seamless', true),
  param.color('tint', 'Tint', '#ff8800'),
  param.select('mode', 'Mode', ['A', 'B', 'C'], 1),
  param.vec2('center', 'Center', [0, 0], -1, 1),
  param.text('label', 'Label', 'hi', { maxLength: 4 }),
  param.gradient('ramp', 'Ramp', gradient(['#000000', 0], ['#ffffff', 1])),
];

describe('defaultValues', () => {
  it('returns every default keyed by param', () => {
    const v = defaultValues(defs);
    expect(v.scale).toBe(4);
    expect(v.mode).toBe(1);
    expect(v.center).toEqual([0, 0]);
    expect(Object.keys(v)).toHaveLength(defs.length);
  });
});

describe('sanitizeValue', () => {
  it('clamps and rounds numbers', () => {
    // Typed values may go past the slider (up to 4x the range for floats), not below a 0+ min.
    expect(sanitizeValue(defs[0]!, 200)).toBe(32 + 31 * 3);
    expect(sanitizeValue(defs[0]!, 40)).toBe(40);
    expect(sanitizeValue(defs[0]!, -3)).toBe(1);
    expect(sanitizeValue(defs[1]!, 3.7)).toBe(4);
    expect(sanitizeValue(defs[0]!, Number.NaN)).toBe(4);
    expect(sanitizeValue(defs[0]!, '5')).toBe(4);
  });

  it('validates select options', () => {
    expect(sanitizeValue(defs[4]!, 2)).toBe(2);
    expect(sanitizeValue(defs[4]!, 7)).toBe(1);
  });

  it('normalizes colors', () => {
    expect(sanitizeValue(defs[3]!, '#ABCDEF')).toBe('#abcdef');
    expect(sanitizeValue(defs[3]!, 'red')).toBe('#ff8800');
  });

  it('clamps vec2 and rejects malformed arrays', () => {
    expect(sanitizeValue(defs[5]!, [5, -5])).toEqual([1, -1]);
    expect(sanitizeValue(defs[5]!, [1])).toEqual([0, 0]);
    expect(sanitizeValue(defs[5]!, ['a', 1])).toEqual([0, 0]);
  });

  it('truncates text', () => {
    expect(sanitizeValue(defs[6]!, 'abcdefgh')).toBe('abcd');
  });

  it('validates gradients', () => {
    const g = sanitizeValue(defs[7]!, { stops: [{ pos: 2, color: '#FF0000' }] });
    expect(g).toEqual({ stops: [{ pos: 1, color: '#ff0000', alpha: 1 }] });
    expect(sanitizeValue(defs[7]!, { stops: [] })).toEqual(defs[7]!.default);
  });
});

describe('sanitizeValues', () => {
  it('drops unknown keys and fills missing ones', () => {
    const v = sanitizeValues(defs, { scale: 8, bogus: 1 });
    expect(v.scale).toBe(8);
    expect(v.octaves).toBe(5);
    expect('bogus' in v).toBe(false);
  });

  it('uses provided defaults as fallback', () => {
    const v = sanitizeValues(defs, {}, { scale: 16 });
    expect(v.scale).toBe(16);
  });

  it('accepts non-object input', () => {
    expect(sanitizeValues(defs, null)).toEqual(defaultValues(defs));
  });
});
