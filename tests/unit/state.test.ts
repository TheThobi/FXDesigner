import { describe, expect, it } from 'vitest';
import {
  defaultSharedPost,
  postOf,
  withPostScope,
  withPostValues,
  type EditorState,
} from '../../src/app/state';
import { DEFAULT_RAMP } from '../../src/engine/post/schema';
import { getGenerator } from '../../src/generators/registry';

const noise = getGenerator('fractal-noise')!;
const cells = getGenerator('cellular')!;
const flowmap = getGenerator('flowmap-painter')!;

const base: EditorState = {
  generatorId: noise.id,
  params: {},
  post: {},
  resolution: 512,
  seed: 1,
  ramp: DEFAULT_RAMP,
  postScope: 'global',
  sharedPost: defaultSharedPost(),
};

describe('post scope', () => {
  it('global: the look follows every generator, output settings stay per generator', () => {
    const s = withPostValues(base, noise, {
      ...postOf(base, noise),
      posterizeOn: true,
      alphaMode: 1,
    });
    expect(postOf(s, cells).posterizeOn).toBe(true);
    expect(postOf(s, cells).alphaMode).not.toBe(1);
    expect(postOf(s, noise).alphaMode).toBe(1);
  });

  it('data generators never receive the shared look', () => {
    const s = withPostValues(base, noise, { ...postOf(base, noise), kuwaharaOn: true });
    expect(postOf(s, flowmap).kuwaharaOn).toBe(false);
  });

  it('switching to local keeps every look and then isolates edits', () => {
    let s = withPostValues(base, noise, { ...postOf(base, noise), posterizeOn: true });
    s = withPostScope(s, cells, 'local');
    expect(postOf(s, cells).posterizeOn).toBe(true);
    expect(postOf(s, noise).posterizeOn).toBe(true);
    s = withPostValues(s, cells, { ...postOf(s, cells), posterizeOn: false });
    expect(postOf(s, cells).posterizeOn).toBe(false);
    expect(postOf(s, noise).posterizeOn).toBe(true);
  });

  it('switching back to global adopts the current generator look', () => {
    let s: EditorState = { ...base, postScope: 'local' };
    s = withPostValues(s, cells, { ...postOf(s, cells), halftoneOn: true });
    s = withPostScope(s, cells, 'global');
    expect(postOf(s, noise).halftoneOn).toBe(true);
  });
});
