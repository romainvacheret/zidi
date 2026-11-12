import { useEffect, useState } from 'react';
import { characterHref, getCharacterDetails, getWordDetails } from '../dictionary';
import type { GraphNode } from '../types';

export default function GraphNodePreview({ node }: { node: GraphNode }) {
  const [lookup, setLookup] = useState<{ pinyin: string; gloss: string | null } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const hasVocabulary = node.entries.length > 0;

  useEffect(() => {
    if (hasVocabulary) return;
    const controller = new AbortController();
    const lookup = Array.from(node.id).length > 1 ? getWordDetails : getCharacterDetails;
    lookup(node.id, controller.signal).then(data => {
      if (!controller.signal.aborted) setLookup({ pinyin: data.readings.join(' · ') || data.pinyin, gloss: data.gloss });
    }).catch(() => {
      if (!controller.signal.aborted) setUnavailable(true);
    });
    return () => controller.abort();
  }, [node.id, hasVocabulary]);

  const pinyin = hasVocabulary
    ? [...new Set(node.entries.map(entry => entry.pronunciation.trim()).filter(Boolean))].join(' · ')
    : lookup?.pinyin;
  const gloss = (hasVocabulary ? node.entries[0].description : lookup?.gloss)?.split(';')[0].trim();

  return <a className="graph-preview-link" href={characterHref(node.id)} aria-label={`Open details for ${node.id}`}>
    <span className="graph-preview-heading"><span lang="zh">{node.id}</span>
      <span className="graph-preview-pinyin" lang="zh-Latn">{pinyin || (unavailable || lookup || hasVocabulary ? 'Pronunciation unavailable' : 'Loading…')}</span>
    </span>
    <span className="graph-preview-gloss">{gloss || (unavailable ? 'Details unavailable. Try opening the entry.' : hasVocabulary || lookup ? 'No definition available.' : 'Loading meaning…')}</span>
    <span className="graph-preview-action">Open {Array.from(node.id).length === 1 ? 'character' : 'word'} details <span aria-hidden="true">→</span></span>
  </a>;
}
