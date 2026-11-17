import { useEffect, useRef, useState } from 'react';
import { characterHref, getWordDetails, type WordDetailsData } from '../dictionary';
import { graphHref } from '../navigation';
import { vocabularyNodes } from '../vocabulary';
import EntryPanel from './EntryPanel';

function cachedDetails(word: string): WordDetailsData | null {
  const node = vocabularyNodes.get(word);
  if (!node) return null;
  return {
    character: word, pinyin: node.entries.map(entry => entry.pronunciation).join(' · '),
    gloss: node.entries[0]?.description || null, codepoint: null, traditional: null,
    readings: [...new Set(node.entries.map(entry => entry.pronunciation))],
    definitions: [...new Set(node.entries.map(entry => entry.description))],
    hsk_level: null, movie_rank: null, book_rank: null, sources: [],
    characters: [...new Set(Array.from(word).filter(character => /^\p{Script=Han}$/u.test(character)))],
  };
}

export default function WordDetails({ word, full = true, onClose = () => {}, returnFocusTo }: {
  word: string; full?: boolean; onClose?(): void; returnFocusTo?: HTMLElement | null;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const [data, setData] = useState<WordDetailsData | null>(() => cachedDetails(word));
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (full) title.current?.focus();
  }, [word, full]);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    getWordDetails(word, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted && !cachedDetails(word)) {
        setError(reason instanceof Error ? reason.message : 'Could not load word details.');
      }
    });
    return () => controller.abort();
  }, [word, attempt]);
  const Heading = full ? 'h1' : 'h2';
  const content = <>
    <header className="character-toolbar">
      <div><span className="eyebrow">{full ? 'Dictionary entry' : 'Quick look'}</span>
        <Heading ref={title} tabIndex={-1} id="word-detail-title">{word} <span>Word details</span></Heading>
      </div>
      {full && data && <a className="secondary-button graph-entry-link" href={graphHref(word)}>View in graph <span aria-hidden="true">↗</span></a>}
      {!full && <button autoFocus type="button" className="icon-button" onClick={onClose} aria-label="Close word details">×</button>}
    </header>
    {!data && !error && <p className="detail-loading" role="status">Loading word details…</p>}
    {error && <div className="detail-error"><p role="alert">{error}</p>
      <button type="button" className="secondary-button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
    </div>}
    {data && <>
      <div className="word-entry-intro"><span lang="zh">{data.character}</span>
        <p className="character-readings" lang="zh-Latn">{data.readings.join(' · ') || data.pinyin || 'Pronunciation unavailable'}</p>
        {data.traditional && data.traditional !== data.character && <p>Traditional: <span lang="zh-Hant">{data.traditional}</span></p>}
        {data.hsk_level !== null && <p>HSK level {data.hsk_level}</p>}
      </div>
      <div className="character-sections">
        <section className="character-section"><h3>Meanings</h3>
          {data.definitions.length ? data.definitions.map((definition, index) => <p key={index}>{definition}</p>)
            : <p>{data.gloss || 'No definition available.'}</p>}
        </section>
        <section className="character-section"><h3>Constituent characters</h3>
          <div className="word-characters">{data.characters.map(character => <a key={character}
            href={characterHref(character)} lang="zh" aria-label={`Open details for ${character}`}>{character}</a>)}</div>
        </section>
        {(data.movie_rank || data.book_rank) ? <section className="character-section"><h3>Usage</h3>
          <dl className="usage-facts">
            {data.movie_rank !== null && <div><dt>Subtitle word frequency rank</dt><dd>#{data.movie_rank.toLocaleString()}</dd></div>}
            {data.book_rank !== null && <div><dt>Book word frequency rank</dt><dd>#{data.book_rank.toLocaleString()}</dd></div>}
          </dl>
        </section> : null}
        {full && data.sources.length > 0 && <section className="character-section"><h3>Dictionary sources</h3><p>{data.sources.join(' · ')}</p></section>}
      </div>
    </>}
    {!full && <footer className="character-footer"><a className="primary-link" href={characterHref(word)}>Open full details <span aria-hidden="true">↗</span></a></footer>}
  </>;
  if (full) return <article className="character-page"><a className="back-link" href="#/dictionary">← Back to results</a>{content}</article>;
  return <EntryPanel labelledBy="word-detail-title" onClose={onClose} returnFocusTo={returnFocusTo}>{content}</EntryPanel>;
}
