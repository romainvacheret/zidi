import type { Graph, GraphLink, VocabularyElement } from './types';

const isHanCharacter = (text: string) => /^\p{Script=Han}$/u.test(text);

export function toGraph(vocabulary: readonly VocabularyElement[]): Graph {
  const nodes = new Map<string, { id: string; entries: VocabularyElement[] }>();
  const links = new Map<string, GraphLink>();

  const addNode = (id: string) => {
    let node = nodes.get(id);
    if (!node) {
      node = { id, entries: [] };
      nodes.set(id, node);
    }
    return node;
  };

  for (const entry of vocabulary) {
    const text = entry.text.trim();
    if (!text) continue;

    // A label can have several readings/meanings and still be one graph node.
    addNode(text).entries.push(entry);

    // Iterate Unicode code points, not UTF-16 units. Punctuation in vocabulary
    // patterns (e.g. 因为…所以…) is not a Chinese character relationship.
    for (const character of new Set(Array.from(text).filter(isHanCharacter))) {
      addNode(character);
      if (text === character) continue;

      links.set(JSON.stringify([text, character]), {
        source: text,
        target: character,
      });
    }
  }

  return { nodes: [...nodes.values()], links: [...links.values()] };
}
