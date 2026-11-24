import { describe, expect, it } from 'vitest';
import type { GpuContext } from '../../src/engine/gl/GpuContext';
import { DifferentialGrowth } from '../../src/generators/simulation/growth/simulation';
import { differentialGrowth } from '../../src/generators/simulation/growth/definition';
import { defaultValues } from '../../src/params/values';

/** The CPU part only: shaders are never compiled here. */
const fakeGpu = { prepareProgram: () => undefined } as unknown as GpuContext;

interface Internals {
  count: number;
  next: Int32Array;
  prev: Int32Array;
  xs: Float64Array;
}

describe('DifferentialGrowth', () => {
  it('grows rings into longer curves within the node budget, links intact', () => {
    const sim = new DifferentialGrowth(fakeGpu);
    const params = {
      ...defaultValues(differentialGrowth.params),
      maxNodes: 6000,
      stepsPerFrame: 1,
    };
    sim.reset(params, 3);
    const g = sim as unknown as Internals;
    const start = g.count;
    const t0 = performance.now();
    for (let i = 0; i < 400; i++) sim.step(params);
    const perStep = (performance.now() - t0) / 400;
    expect(g.count).toBeGreaterThan(start * 4);
    expect(g.count).toBeLessThanOrEqual(6000);
    for (let i = 0; i < g.count; i++) {
      expect(g.prev[g.next[i]!]).toBe(i);
      expect(g.xs[i]).toBeGreaterThanOrEqual(0);
      expect(g.xs[i]).toBeLessThan(1);
    }
    // Generous bound (CI machines vary); typical is well under a millisecond per step.
    expect(perStep).toBeLessThan(20);
  });

  it('falls asleep once the budget is spent and the pattern settles', () => {
    const sim = new DifferentialGrowth(fakeGpu);
    const params = {
      ...defaultValues(differentialGrowth.params),
      maxNodes: 1500,
      stepsPerFrame: 1,
    };
    sim.reset(params, 5);
    for (let i = 0; i < 3000; i++) sim.step(params);
    const s = sim as unknown as { settled: boolean };
    expect(s.settled).toBe(true);
    // A bigger budget wakes it up.
    sim.step({ ...params, maxNodes: 3000 });
    expect(s.settled).toBe(false);
  });
});
