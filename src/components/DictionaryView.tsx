import { useEffect, useRef, useState, type FormEvent } from 'react';
import { searchDictionary, type SearchMode, type SearchResponse } from '../dictionary';
import CharacterDetails from './CharacterDetails';
import WordDetails from './WordDetails';
import { useDictionaryRoute } from '../hooks/useDictionaryRoute';

export default function DictionaryView({ active = true }: { active?: boolean }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('character');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const selectedCard = useRef<HTMLButtonElement | null>(null);
  const fullCharacter = useDictionaryRoute();

  useEffect(() => () => request.current?.abort(), []);

  function resetResults() {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setResponse(null);
    setError('');
    setSelectedCharacter(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    setResponse(null);
    try {
      const result = await searchDictionary(query.trim(), mode, controller.signal);
      if (!controller.signal.aborted) setResponse(result);
    } catch {
      if (!controller.signal.aborted) {
        setError('Could not search the dictionary. Check that the backend is running and try again.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <main className="dictionary-view">
      <div hidden={fullCharacter !== null}>
      <header>
        <span className="eyebrow">Your language workspace</span>
        <h1>Dictionary</h1>
        <p>Discover words and characters. Understand how they fit.</p>
      </header>
      <div className={`dictionary-workspace${selectedCharacter ? ' with-preview' : ''}`}>
      <div className="dictionary-browser">
      <form className="dictionary-search" onSubmit={submit}>
        <label>
          Search by
          <select value={mode} onChange={event => {
            resetResults();
            setMode(event.target.value as SearchMode);
          }}>
            <option value="character">Chinese / Pinyin</option>
            <option value="translation">English translation</option>
          </select>
        </label>
        <label className="dictionary-query">
          {mode === 'translation' ? 'English meaning' : 'Chinese or pinyin'}
          <input value={query} maxLength={200} onChange={event => {
            resetResults();
            setQuery(event.target.value);
          }} placeholder={mode === 'translation' ? 'e.g. law or world' : 'e.g. 世界, shì jiè, shi4jie4, or shijie'} />
        </label>
        <button type="submit" disabled={!query.trim() || loading}>Search</button>
      </form>
      <div className="dictionary-result-status" role="status" aria-live="polite">
        {loading && <p>Searching…</p>}
        {!loading && !error && response === null && <div className="dictionary-empty">
          <span className="empty-character" lang="zh" aria-hidden="true">字</span>
          <h2>A character is a place to start.</h2>
          <p>Search by Chinese characters, a word’s pinyin, or English meaning. Select a result to explore its entry.</p>
        </div>}
        {response && <p>{response.results.length === 0
          ? (mode === 'translation' ? 'No matching translations.' : 'No matching entries.')
          : `${response.results.length} result${response.results.length === 1 ? '' : 's'} · Most common first`}
          {response.results.length === response.limit && ' · Result limit reached. Refine your search for more specific matches.'}
        </p>}
      </div>
      {error && <p role="alert">{error}</p>}
      <ul className="dictionary-results" aria-label="Dictionary results" aria-busy={loading}>
        {response?.results.map((entry, index) => (
          <li className="dictionary-card" key={`${entry.character}-${index}`}>
            <button type="button" className="dictionary-card-button"
              aria-label={`View details for ${entry.character}`}
              aria-pressed={selectedCharacter === entry.character}
              onClick={event => {
                selectedCard.current = event.currentTarget;
                setSelectedCharacter(entry.character);
              }}>
            <span className="dictionary-character" lang="zh">{entry.character}</span>
            <span className="dictionary-pinyin" lang="zh-Latn">{entry.pinyin}</span>
            {entry.gloss && <p>{entry.gloss}</p>}
            <span className="card-detail-hint">Explore {Array.from(entry.character).length > 1 ? 'word' : 'character'} <span aria-hidden="true">→</span></span>
            </button>
          </li>
        ))}
      </ul>
      </div>
      {active && selectedCharacter && !fullCharacter && (Array.from(selectedCharacter).length > 1
        ? <WordDetails key={selectedCharacter} word={selectedCharacter} full={false} returnFocusTo={selectedCard.current}
          onClose={() => setSelectedCharacter(null)} />
        : <CharacterDetails key={selectedCharacter}
          character={selectedCharacter} returnFocusTo={selectedCard.current}
          onClose={() => setSelectedCharacter(null)} />)}
      </div>
      </div>
      {fullCharacter && (Array.from(fullCharacter).length > 1
        ? <WordDetails key={fullCharacter} word={fullCharacter} />
        : <CharacterDetails key={`full-${fullCharacter}`} character={fullCharacter} full
          onClose={() => { window.location.hash = '/dictionary'; }} />)}
    </main>
  );
}
