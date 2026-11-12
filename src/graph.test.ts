import { expect, test } from 'vitest';
import { toGraph } from './graph';
import type { VocabularyElement } from './types';

const entry = (text: string, pronunciation = ''): VocabularyElement => ({
  text, pronunciation, description: '',
});

test('connects words to distinct constituent characters without duplicate nodes or edges', () => {
  const graph = toGraph([entry('爸爸'), entry('爸'), entry('爸爸')]);
  expect(graph.nodes.map(node => node.id)).toEqual(['爸爸', '爸']);
  expect(graph.links).toEqual([{ source: '爸爸', target: '爸' }]);
});

test('keeps different readings on one node, including a character first seen in a word', () => {
  const readings = [entry('长', 'cháng'), entry('长', 'zhǎng')];
  const graph = toGraph([entry('长江'), ...readings]);
  expect(graph.nodes.find(node => node.id === '长')?.entries).toEqual(readings);
  expect(graph.nodes.filter(node => node.id === '长')).toHaveLength(1);
});

test('does not create self links for Han characters outside the basic Unicode plane', () => {
  const graph = toGraph([entry('𠮷'), entry('𠮷野')]);
  expect(graph.nodes.map(node => node.id)).toEqual(['𠮷', '𠮷野', '野']);
  expect(graph.links).toEqual([
    { source: '𠮷野', target: '𠮷' },
    { source: '𠮷野', target: '野' },
  ]);
});

test('keeps vocabulary patterns but excludes their punctuation from character relationships', () => {
  const graph = toGraph([entry('因为…所以…')]);
  expect(graph.nodes.map(node => node.id)).toEqual(['因为…所以…', '因', '为', '所', '以']);
  expect(graph.links.map(link => link.target)).toEqual(['因', '为', '所', '以']);
});

test('skips blank entries and builds fresh graphs without modifying input', () => {
  const vocabulary = Object.freeze([Object.freeze(entry('')), Object.freeze(entry('爱'))]);
  const first = toGraph(vocabulary);
  const second = toGraph(vocabulary);
  expect(first.nodes.map(node => node.id)).toEqual(['爱']);
  expect(first.links).toEqual([]);
  expect(first).toEqual(second);
  expect(first.nodes[0]).not.toBe(second.nodes[0]);
});
