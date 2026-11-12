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

export interface CharacterDetails extends DictionaryEntry {
  stroke_count: number | null;
  original_meaning: string | null;
  hint: string | null;
  hsk_level: number | null;
  movie_rank: number | null;
  book_rank: number | null;
  readings: string[];
  components: { character: string; roles: string[]; hint: string | null }[];
  words: { word: string; traditional: string | null; gloss: string | null }[];
  variants: string[];
  sources: string[];
}

export function characterHref(character: string) {
  return `#/dictionary/${encodeURIComponent(character)}`;
}

export async function getCharacterDetails(character: string, signal: AbortSignal): Promise<CharacterDetails> {
  const response = await fetch(`/api/dictionary/characters/${encodeURIComponent(character)}`, { signal });
  if (response.status === 404) throw new Error('This character is not in the dictionary.');
  if (!response.ok) throw new Error('Could not load character details. Please try again.');
  return response.json();
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
