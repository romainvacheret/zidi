export type SearchMode = 'character' | 'translation';

export interface DictionaryEntry {
  character: string;
  pinyin: string;
  gloss: string | null;
  codepoint: string | null;
}

export interface SearchResponse {
  results: DictionaryEntry[];
  limit: number;
}

// HTTP stays outside the UI so a future desktop host can change the transport.
export async function searchDictionary(
  query: string, mode: SearchMode, signal: AbortSignal,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, mode });
  const response = await fetch(`/api/dictionary/search?${params}`, { signal });
  if (!response.ok) throw new Error('Dictionary search failed. Please try again.');
  return response.json();
}
