import type { VocabularyElement, Graph } from './types';
import { toGraph } from './graph';

export const MAX_GRAPH_NODES = 500;
// Reuse already fetched dictionary content when opening a word's full entry.
export const vocabularyNodes = new Map<string, Graph['nodes'][number]>();

export interface GraphVocabularyResponse {
  entries: VocabularyElement[];
  has_more: boolean;
  allowed_characters?: string[] | null;
}

export async function getGraphNeighborhood(target: string, limit: number, signal: AbortSignal, levels: readonly number[]): Promise<GraphVocabularyResponse> {
  const params = new URLSearchParams({ target, limit: String(limit) });
  levels.forEach(level => params.append('levels', String(level)));
  const response = await fetch(`/api/graph/neighborhood?${params}`, { signal });
  if (!response.ok) throw new Error('Could not load related entries. Please try again.');
  return response.json();
}

export async function getGraphVocabulary(levels: readonly number[], limit: number, signal: AbortSignal,
  character?: string, exclude: readonly string[] = []): Promise<GraphVocabularyResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  levels.forEach(level => params.append('levels', String(level)));
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

export function filterGraphCharacters(graph: Graph, allowed: readonly string[] | null | undefined): Graph {
  if (!allowed) return graph;
  const characters = new Set(allowed);
  const nodes = graph.nodes.filter(node => Array.from(node.id).length > 1 || characters.has(node.id));
  const ids = new Set(nodes.map(node => node.id));
  return { nodes, links: graph.links.filter(link => ids.has(link.source) && ids.has(link.target)) };
}
