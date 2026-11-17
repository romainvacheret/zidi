import type { VocabularyElement, Graph } from './types';
import { toGraph } from './graph';

export const MAX_GRAPH_NODES = 500;
// Reuse already fetched dictionary content when opening a word's full entry.
export const vocabularyNodes = new Map<string, Graph['nodes'][number]>();

export async function getGraphVocabulary(level: number, limit: number, signal: AbortSignal,
  character?: string, exclude: readonly string[] = []): Promise<{ entries: VocabularyElement[]; has_more: boolean }> {
  const params = new URLSearchParams({ level: String(level), limit: String(limit) });
  if (character) params.set('character', character);
  exclude.forEach(id => params.append('exclude', id));
  const response = await fetch(`/api/graph/vocabulary?${params}`, { signal });
  if (!response.ok) throw new Error('Could not load graph vocabulary. Please try again.');
  return response.json();
}

export function mergeGraph(graph: Graph, entries: readonly VocabularyElement[], ids: readonly string[] = []): Graph {
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const links = new Map(graph.links.map(link => [JSON.stringify([link.source, link.target]), link]));
  const candidates = [...entries.map(entry => ({ entry, id: entry.text })),
    ...ids.map(id => ({ id, entry: null }))];
  for (const { id, entry } of candidates) {
    const extra = toGraph([entry || { text: id, pronunciation: '', description: '' }]);
    if (new Set([...nodes.keys(), ...extra.nodes.map(node => node.id)]).size > MAX_GRAPH_NODES) continue;
    for (const node of extra.nodes) {
      if (!nodes.has(node.id) || (entry && node.id === id)) {
        nodes.set(node.id, entry ? node : { id: node.id, entries: [] });
      }
    }
    extra.links.forEach(link => links.set(JSON.stringify([link.source, link.target]), link));
  }
  return { nodes: [...nodes.values()], links: [...links.values()] };
}
