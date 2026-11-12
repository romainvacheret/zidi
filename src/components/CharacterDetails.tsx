import { useEffect, useRef, useState } from 'react';
import { characterHref, getCharacterDetails, type CharacterDetails as Details } from '../dictionary';
import { graphHref } from '../navigation';
import EntryPanel from './EntryPanel';

interface Props {
  character: string;
  full?: boolean;
  onClose(): void;
  returnFocusTo?: HTMLElement | null;
}

function DetailContent({ data, full }: { data: Details; full: boolean }) {
  const words = full ? data.words : data.words.slice(0, 5);
  return (
    <>
      <div className="character-hero">
        <span className="character-glyph" lang="zh">{data.character}</span>
        <div>
          <p className="character-readings" lang="zh-Latn">{data.readings.join(' · ') || data.pinyin || 'Pronunciation unavailable'}</p>
          <p className="character-definition">{data.gloss || 'No definition available.'}</p>
        </div>
      </div>
      <dl className="character-facts">
        {data.stroke_count !== null && <div><dt>Strokes</dt><dd>{data.stroke_count}</dd></div>}
        {data.hsk_level !== null && <div><dt>HSK level</dt><dd>{data.hsk_level}</dd></div>}
        {data.codepoint && <div><dt>Unicode</dt><dd>{data.codepoint}</dd></div>}
      </dl>
      <div className="character-sections">
        {(data.hint || data.original_meaning) && <section className="character-section">
          <h3>Origin & structure</h3>
          {data.original_meaning && <p><span className="detail-label">Original meaning</span> {data.original_meaning}</p>}
          {data.hint && <p>{data.hint}</p>}
        </section>}
        {data.components.length > 0 && <section className="character-section">
          <h3>Components</h3>
          <ul className="component-list">
            {data.components.map((component, index) => <li key={`${component.character}-${index}`}>
              <span lang="zh" className="component-character">{component.character}</span>
              <div><span className="detail-label">{component.roles.join(' + ') || 'Component'}</span>
                {component.hint && <p>{component.hint}</p>}</div>
            </li>)}
          </ul>
        </section>}
        <section className="character-section">
          <h3>Usage</h3>
          {data.movie_rank || data.book_rank ? <dl className="usage-facts">
            {data.movie_rank !== null && data.movie_rank > 0 && <div><dt>Subtitle frequency rank</dt><dd>#{data.movie_rank.toLocaleString()}</dd></div>}
            {data.book_rank !== null && data.book_rank > 0 && <div><dt>Book frequency rank</dt><dd>#{data.book_rank.toLocaleString()}</dd></div>}
          </dl> : <p className="muted">Usage data is not available for this character.</p>}
          {(data.movie_rank || data.book_rank) && <p className="detail-note">A lower rank means more frequent usage.</p>}
        </section>
        {words.length > 0 && <section className="character-section">
          <h3>Common words</h3>
          <ul className="character-words">
            {words.map((word, index) => <li key={`${word.word}-${index}`}>
              <span lang="zh">{word.word}</span><span>{word.gloss || '—'}</span>
            </li>)}
          </ul>
          {!full && data.words.length > words.length && <p className="detail-note">More words in the full entry.</p>}
        </section>}
        {full && data.variants.length > 0 && <section className="character-section">
          <h3>Variants</h3>
          <p className="character-variants" lang="zh">{data.variants.join('　')}</p>
        </section>}
        {full && data.sources.length > 0 && <section className="character-section">
          <h3>Dictionary sources</h3>
          <p className="detail-note">{data.sources.join(' · ')}</p>
        </section>}
      </div>
    </>
  );
}

export default function CharacterDetails({ character, full = false, onClose, returnFocusTo }: Props) {
  const [data, setData] = useState<Details | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    getCharacterDetails(character, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load character details.');
    });
    return () => controller.abort();
  }, [character, attempt]);

  useEffect(() => {
    if (full) title.current?.focus();
  }, [full]);

  const Heading = full ? 'h1' : 'h2';
  const content = <>
    <header className="character-toolbar">
      <div><span className="eyebrow">{full ? 'Dictionary entry' : 'Quick look'}</span>
        <Heading ref={title} tabIndex={-1} id="character-detail-title">{character} <span>Character details</span></Heading>
      </div>
      {full && data && <a className="secondary-button graph-entry-link" href={graphHref(character)}>View in graph <span aria-hidden="true">↗</span></a>}
      {!full && <button autoFocus type="button" className="icon-button" onClick={onClose} aria-label="Close character details">×</button>}
    </header>
    {!data && !error && <p role="status" className="detail-loading">Loading character details…</p>}
    {error && <div className="detail-error"><p role="alert">{error}</p>
      <button type="button" className="secondary-button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
    </div>}
    {data && <DetailContent data={data} full={full} />}
    {!full && <footer className="character-footer">
      <a className="primary-link" href={characterHref(character)}>Open full details <span aria-hidden="true">↗</span></a>
    </footer>}
  </>;

  if (full) return <article className="character-page">
    <a className="back-link" href="#/dictionary">← Back to results</a>
    {content}
  </article>;
  return <EntryPanel labelledBy="character-detail-title" onClose={onClose} returnFocusTo={returnFocusTo}>
    {content}
  </EntryPanel>;
}
