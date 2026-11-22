import { describe, expect, it } from 'vitest';
import {
  createNode,
  evaluationOrder,
  fullEvaluationOrder,
  imageDims,
  newNodeId,
  withLink,
  withNodeGenerator,
  withoutNode,
  type EditorState,
} from '../../src/app/state';
import { getGenerator } from '../../src/generators/registry';

const noise = getGenerator('fractal-noise')!;
const cells = getGenerator('cellular')!;
const flowmap = getGenerator('flowmap-painter')!;

function graph(): EditorState {
  return {
    nodes: [
      createNode(noise, 'n1', 0, 0),
      createNode(cells, 'n2', 400, 0),
      createNode(noise, 'n3', 800, 0),
    ],
    links: [],
    selectedId: 'n1',
    resolution: 512,
    seed: 1,
    aspect: 1,
  };
}

describe('node graph', () => {
  it('links nodes, replacing the previous link of an input', () => {
    let s = withLink(graph(), { from: 'n1', to: 'n3', input: 'base' });
    s = withLink(s, { from: 'n2', to: 'n3', input: 'base' });
    expect(s.links).toEqual([{ from: 'n2', to: 'n3', input: 'base' }]);
  });

  it('refuses links that would create a cycle', () => {
    const s = withLink(graph(), { from: 'n1', to: 'n2', input: 'base' });
    expect(withLink(s, { from: 'n2', to: 'n1', input: 'mask' })).toBe(s);
    expect(withLink(s, { from: 'n1', to: 'n1', input: 'mask' })).toBe(s);
  });

  it('evaluates upstream nodes first', () => {
    let s = withLink(graph(), { from: 'n3', to: 'n2', input: 'warp' });
    s = withLink(s, { from: 'n2', to: 'n1', input: 'base' });
    expect(evaluationOrder(s, 'n1').map((n) => n.id)).toEqual(['n3', 'n2', 'n1']);
    expect(fullEvaluationOrder(s).map((n) => n.id)).toEqual(['n3', 'n2', 'n1']);
  });

  it('removing a node drops its links and moves the selection', () => {
    let s = withLink(graph(), { from: 'n1', to: 'n2', input: 'base' });
    s = withoutNode(s, 'n1');
    expect(s.nodes.map((n) => n.id)).toEqual(['n2', 'n3']);
    expect(s.links).toEqual([]);
    expect(s.selectedId).toBe('n3');
  });

  it('never removes the last node', () => {
    const one: EditorState = { ...graph(), nodes: [createNode(noise, 'n1', 0, 0)] };
    expect(withoutNode(one, 'n1')).toBe(one);
  });

  it('new ids never collide', () => {
    expect(newNodeId(graph().nodes)).toBe('n4');
  });
});

describe('swapping a node generator', () => {
  it('keeps the look and ramp, resets parameters', () => {
    const base = graph();
    const looked: EditorState = {
      ...base,
      nodes: base.nodes.map((n) =>
        n.id === 'n1' ? { ...n, post: { ...n.post, posterizeOn: true }, params: { scale: 9 } } : n,
      ),
    };
    const s = withNodeGenerator(looked, 'n1', cells, noise);
    const node = s.nodes[0]!;
    expect(node.generator).toBe('cellular');
    expect(node.post.posterizeOn).toBe(true);
    expect(node.params.scale).toBe(cells.params.find((p) => p.key === 'scale')?.default);
  });

  it('data generators get their own defaults', () => {
    const base = graph();
    const looked: EditorState = {
      ...base,
      nodes: base.nodes.map((n) =>
        n.id === 'n1' ? { ...n, post: { ...n.post, posterizeOn: true } } : n,
      ),
    };
    const s = withNodeGenerator(looked, 'n1', flowmap, noise);
    expect(s.nodes[0]!.post.posterizeOn).toBe(false);
  });
});

describe('workspace aspect', () => {
  it('keeps the long side at the requested size', () => {
    expect(imageDims(512, 1)).toEqual([512, 512]);
    expect(imageDims(512, 2)).toEqual([512, 256]);
    expect(imageDims(512, 0.5)).toEqual([256, 512]);
    expect(imageDims(900, 1 / 3)).toEqual([300, 900]);
  });
});
