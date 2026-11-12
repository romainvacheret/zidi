import type { GraphNode } from './types';

function normalizeText(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/u\u0308/g, 'v').replace(/\p{M}/gu, '');
}

function normalizePinyin(text: string) {
  return normalizeText(text).replace(/[0-5\s'’·._\-\u200b-\u200d]/g, '');
}

export function filterGraphNodes(nodes: readonly GraphNode[], query: string): readonly GraphNode[] {
  const text = normalizeText(query.trim());
  if (!text) return nodes;
  const pinyin = normalizePinyin(query);
  return nodes.filter(node => normalizeText(node.id).includes(text) || node.entries.some(entry =>
    normalizeText(entry.description).includes(text)
    || (pinyin.length > 0 && normalizePinyin(entry.pronunciation).includes(pinyin)),
  ));
}
