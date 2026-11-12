import { useEffect, useRef, useState, type FormEvent } from 'react';
import { searchDictionary, type SearchMode, type SearchResponse } from '../dictionary';

export default function DictionaryView() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('character');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  function resetResults() {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setResponse(null);
    setError('');
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
      <header>
        <h1>Dictionary</h1>
        <p>Find Chinese characters by their writing, pronunciation, or English meaning.</p>
      </header>
      <form className="dictionary-search" onSubmit={submit}>
        <label>
          Search by
          <select value={mode} onChange={event => {
            resetResults();
            setMode(event.target.value as SearchMode);
          }}>
            <option value="character">Character / Pinyin</option>
            <option value="translation">English translation</option>
          </select>
        </label>
        <label className="dictionary-query">
          {mode === 'translation' ? 'English meaning' : 'Character or pinyin'}
          <input value={query} maxLength={200} onChange={event => {
            resetResults();
            setQuery(event.target.value);
          }} placeholder={mode === 'translation' ? 'e.g. law' : 'e.g. 世, shì, shi4, or shi'} />
        </label>
        <button type="submit" disabled={!query.trim() || loading}>Search</button>
      </form>
      <div role="status" aria-live="polite">
        {loading && <p>Searching…</p>}
        {!loading && !error && response === null && <p>Enter a query to explore the dictionary.</p>}
        {response && <p>{response.results.length === 0
          ? (mode === 'translation' ? 'No matching translations.' : 'No matching characters.')
          : `${response.results.length} result${response.results.length === 1 ? '' : 's'}`}
          {response.results.length === response.limit && ' · Result limit reached. Refine your search for more specific matches.'}
        </p>}
      </div>
      {error && <p role="alert">{error}</p>}
      <ul className="dictionary-results" aria-label="Dictionary results" aria-busy={loading}>
        {response?.results.map((entry, index) => (
          <li className="dictionary-card" key={`${entry.character}-${index}`}>
            <span className="dictionary-character" lang="zh">{entry.character}</span>
            <span className="dictionary-pinyin" lang="zh-Latn">{entry.pinyin}</span>
            {entry.gloss && <p>{entry.gloss}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
