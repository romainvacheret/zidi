import { expect, test } from 'vitest';
import { createGraphLayout, pinNode } from './graphLayout';
import { toGraph } from './graph';

const entry = (text: string, description = text) => ({ text, pronunciation: '', description });

test('reuses positioned nodes and mutated links while adding a nearby branch', () => {
  const store = createGraphLayout();
  const original = toGraph([entry('爱好')]);
  const initial = store.update(original);
  initial.nodes.forEach((node, index) => { node.x = 100 + index * 30; node.y = 200; });
  // Model the force engine's replacement of string endpoints with node objects.
  initial.links[0].source = initial.nodes[0];
  initial.links[0].target = initial.nodes[1];
  const updated = store.update(toGraph([entry('爱好', 'hobby'), entry('爱人')]));
  initial.nodes.forEach((node, index) => {
    expect(updated.nodes.find(candidate => candidate.id === node.id)).toBe(node);
    expect([node.x, node.y, node.fx, node.fy]).toEqual([100 + index * 30, 200, 100 + index * 30, 200]);
    expect([node.vx, node.vy]).toEqual([0, 0]);
  });
  expect(updated.links[0]).toBe(initial.links[0]);
  const added = updated.nodes.find(node => node.id === '爱人')!;
  const anchor = updated.nodes.find(node => node.id === '爱')!;
  expect(Math.hypot(added.x! - anchor.x!, added.y! - anchor.y!)).toBeLessThan(75);
  expect(added.fx).toBeUndefined();
  expect(updated.nodes[0].entries[0].description).toBe('hobby');
  expect(original.nodes[0]).not.toHaveProperty('x');
  expect(original.links[0].source).toBe('爱好');
});

test('restores temporarily hidden nodes without leaking coordinates between renderers', () => {
  const store = createGraphLayout();
  const graph = toGraph([entry('爱好')]);
  const initial = store.update(graph);
  const node = initial.nodes[0];
  node.x = -40; node.y = 80;
  store.update({ nodes: [], links: [] });
  const restored = store.update(graph).nodes[0];
  expect(restored).toBe(node);
  expect([restored.x, restored.y, restored.fx, restored.fy]).toEqual([-40, 80, -40, 80]);
  expect(createGraphLayout().update(graph).nodes[0].x).toBeUndefined();
});

test('locks settled or manually moved nodes and preserves their chosen positions', () => {
  const store = createGraphLayout();
  const graph = toGraph([entry('爱')]);
  const node = store.update(graph).nodes[0];
  pinNode(node);
  expect(node.fx).toBeUndefined();
  node.x = 10; node.y = 20;
  store.settle();
  expect([node.fx, node.fy]).toEqual([10, 20]);
  node.x = 90; node.y = 100;
  pinNode(node);
  expect(store.update(graph).nodes[0]).toMatchObject({ x: 90, y: 100, fx: 90, fy: 100 });
});
