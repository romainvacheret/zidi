import { useEffect, useRef } from 'react';
import { characterHref } from '../dictionary';
import { graphHref } from '../navigation';
import { vocabularyNodes } from '../vocabulary';

export default function WordDetails({ word }: { word: string }) {
  const title = useRef<HTMLHeadingElement>(null);
  const node = vocabularyNodes.get(word);
  const characters = [...new Set(Array.from(word).filter(character => /^\p{Script=Han}$/u.test(character)))];
  useEffect(() => { title.current?.focus(); }, [word]);

  return <article className="character-page">
    <a className="back-link" href="#/dictionary">← Back to results</a>
    <header className="character-toolbar">
      <div><span className="eyebrow">HSK vocabulary entry</span>
        <h1 ref={title} tabIndex={-1}>{word} <span>Word details</span></h1>
      </div>
      {node && <a className="secondary-button graph-entry-link" href={graphHref(word)}>View in graph <span aria-hidden="true">↗</span></a>}
    </header>
    {!node ? <p className="detail-error" role="alert">This word is not in the HSK vocabulary graph.</p> : <>
      <div className="word-entry-intro"><span lang="zh">{word}</span>
        <p>HSK 1–3 vocabulary · Select a constituent character to explore its dictionary entry.</p>
      </div>
      <div className="character-sections">
        <section className="character-section"><h3>Readings & meanings</h3>
          {node.entries.map((entry, index) => <div className="word-reading" key={index}>
            <p className="character-readings" lang="zh-Latn">{entry.pronunciation}</p>
            <p>{entry.description}</p>
          </div>)}
        </section>
        <section className="character-section"><h3>Constituent characters</h3>
          <div className="word-characters">{characters.map(character => <a key={character}
            href={characterHref(character)} lang="zh" aria-label={`Open details for ${character}`}>{character}</a>)}</div>
        </section>
      </div>
    </>}
  </article>;
}
