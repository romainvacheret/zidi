import { expect, test } from 'vitest';
import { mergeGraph } from './vocabulary';

test('limits every graph addition to 500 nodes, including constituent characters', () => {
  const initial = { nodes: Array.from({ length: 498 }, (_, i) => ({ id: `node${i}`, entries: [] })), links: [] };
  const graph = mergeGraph(initial, [{ text: '爱好', pronunciation: 'ài hào', description: 'hobby' }]);
  expect(graph.nodes).toHaveLength(498);
  const added = mergeGraph(initial, [], ['爱']);
  expect(added.nodes).toHaveLength(499);
  const expanded = mergeGraph(added, [{ text: '爱好', pronunciation: 'ài hào', description: 'hobby' }]);
  expect(expanded.nodes).toHaveLength(499);
});

test('merges words with shared constituents and deduplicates links', () => {
  const entry = { text: '爱好', pronunciation: 'ài hào', description: 'hobby' };
  const graph = mergeGraph(mergeGraph({ nodes: [], links: [] }, [entry]), [entry], ['爱好']);
  expect(graph.nodes.map(node => node.id)).toEqual(['爱好', '爱', '好']);
  expect(graph.links).toHaveLength(2);
  expect(graph.nodes[0].entries).toEqual([entry]);
});
