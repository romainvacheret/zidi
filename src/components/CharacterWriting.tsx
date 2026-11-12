import { useState } from 'react';
import { characterHref, type CharacterDetails } from '../dictionary';
import CharacterGlyph from './CharacterGlyph';
import StrokeOrder from './StrokeOrder';

const colors = ['#2563eb', '#b45309', '#047857', '#9333ea', '#be185d', '#0e7490'];

export default function CharacterWriting({ data }: { data: CharacterDetails }) {
  const [selected, setSelected] = useState<number | null>(null);
  const strokes = data.stroke_data;
  const mapped = strokes?.component_indices.some(index => index !== null) ?? false;
  return <div className="character-writing">
    <section className="writing-card" aria-labelledby="stroke-order-heading">
      <header><span className="eyebrow">Learn to write</span><h3 id="stroke-order-heading">Stroke order</h3></header>
      {strokes ? <StrokeOrder key={data.character} character={data.character} data={strokes} />
        : <p className="writing-unavailable">Stroke-order data is not available for this character.</p>}
    </section>
    <section className="writing-card" aria-labelledby="decomposition-heading">
      <header><span className="eyebrow">Understand the parts</span><h3 id="decomposition-heading">Component decomposition</h3></header>
      {strokes ? <CharacterGlyph label={`Component decomposition of ${data.character}`}>
        {strokes.strokes.map((stroke, index) => {
          const component = strokes.component_indices[index];
          return <path key={index} d={stroke} fill={component == null ? '#94a3b8' : colors[component % colors.length]}
            opacity={selected === null || selected === component ? 1 : 0.15} />;
        })}
      </CharacterGlyph> : <div className="decomposition-placeholder" lang="zh" aria-hidden="true">{data.character}</div>}
      {data.components.length > 0 ? <ul className="decomposition-legend">
        {data.components.map((component, index) => {
          const hasStrokes = strokes?.component_indices.includes(index) ?? false;
          return <li key={`${component.character}-${index}`}>
            <button type="button" className="decomposition-part" aria-pressed={selected === index}
              disabled={!hasStrokes} onClick={() => setSelected(selected === index ? null : index)}
              aria-label={`Highlight component ${component.character}`}>
              <span className="component-swatch" style={{ backgroundColor: hasStrokes ? colors[index % colors.length] : '#94a3b8' }} />
              <span className="component-character" lang="zh">{component.character}</span>
              <span className="detail-label">{component.roles.join(' + ') || 'Component'}</span>
            </button>
            <a href={characterHref(component.character)} aria-label={`Open component ${component.character}`}>Explore <span aria-hidden="true">↗</span></a>
            {component.hint && <p>{component.hint}</p>}
          </li>;
        })}
      </ul> : <p className="detail-note">No component decomposition is recorded for this character.</p>}
      {data.components.length > 0 && <p className="detail-note">{mapped
        ? 'Select a component to highlight its strokes. Gray strokes have no component mapping.'
        : 'Component-to-stroke mapping is unavailable; the character remains neutral.'}</p>}
    </section>
    <p className="writing-attribution">Character data: <a href={`https://www.dong-chinese.com/wiki/${encodeURIComponent(data.character)}`} target="_blank" rel="noreferrer">Dong Chinese</a>
      {strokes && <> · Stroke graphics: <a href="https://github.com/skishore/makemeahanzi" target="_blank" rel="noreferrer">Make Me a Hanzi</a></>}</p>
  </div>;
}
