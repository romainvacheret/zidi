import { useEffect, useId, useRef, useState } from 'react';
import type { CharacterStrokeData } from '../dictionary';
import CharacterGlyph from './CharacterGlyph';

export default function StrokeOrder({ character, data }: { character: string; data: CharacterStrokeData }) {
  const count = data.strokes.length;
  const id = useId().replace(/:/g, '');
  const [frame, setFrame] = useState({ completed: count, progress: 0 });
  const frameRef = useRef(frame);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion) return;
    let previous: number | null = null;
    let request = 0;
    function animate(now: number) {
      const elapsed = previous === null ? 0 : now - previous;
      previous = now;
      const current = frameRef.current;
      const progress = current.progress + elapsed / (700 / speed);
      const next = progress >= 1.22
        ? { completed: Math.min(count, current.completed + 1), progress: 0 }
        : { completed: current.completed, progress };
      frameRef.current = next;
      setFrame(next);
      if (next.completed >= count) setPlaying(false);
      else request = requestAnimationFrame(animate);
    }
    request = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(request);
  }, [playing, reducedMotion, speed, count]);

  function jump(completed: number) {
    setPlaying(false);
    const next = { completed: Math.max(0, Math.min(count, completed)), progress: 0 };
    frameRef.current = next;
    setFrame(next);
  }

  function togglePlayback() {
    if (playing) { setPlaying(false); return; }
    if (frameRef.current.completed >= count) jump(0);
    setPlaying(true);
  }

  return <div className="stroke-order-player">
    <CharacterGlyph label={`Stroke order for ${character}`}>
      <defs>{data.strokes.map((stroke, index) => <clipPath key={index} id={`${id}-stroke-${index}`}>
        <path d={stroke} />
      </clipPath>)}</defs>
      {data.strokes.map((stroke, index) => <path key={index} d={stroke}
        fill={index < frame.completed ? '#243654' : '#e4eaf3'} />)}
      {frame.completed < count && <path
        d={data.medians[frame.completed].map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ')}
        clipPath={`url(#${id}-stroke-${frame.completed})`} fill="none" stroke="#2451b5"
        strokeWidth="220" strokeLinecap="round" strokeLinejoin="round"
        pathLength="1" strokeDasharray="1" strokeDashoffset={1 - Math.min(1, frame.progress)} />}
    </CharacterGlyph>
    <p className="stroke-progress" role="status" aria-live="polite">
      {playing ? `Drawing stroke ${Math.min(count, frame.completed + 1)} of ${count}` : `${frame.completed} of ${count} strokes`}
    </p>
    <input className="stroke-slider" type="range" min={0} max={count} step={1} value={frame.completed}
      aria-label="Stroke progress" onChange={event => jump(Number(event.target.value))} />
    <div className="stroke-playback-controls">
      <button type="button" className="secondary-button" onClick={() => jump(frame.completed - 1)} disabled={frame.completed === 0}
        aria-label="Previous stroke">←</button>
      <button type="button" className="secondary-button" onClick={togglePlayback} disabled={reducedMotion}
        aria-label={playing ? 'Pause stroke order' : 'Play stroke order'}>{playing ? 'Pause' : 'Play'}</button>
      <button type="button" className="secondary-button" onClick={() => jump(frame.completed + 1)} disabled={frame.completed === count}
        aria-label="Next stroke">→</button>
      <button type="button" className="secondary-button" onClick={() => jump(0)}>Reset</button>
      <label className="stroke-speed">Speed<select value={speed} onChange={event => setSpeed(Number(event.target.value))}>
        <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option>
      </select></label>
    </div>
    {reducedMotion && <p className="detail-note">Reduced motion is enabled. Use the arrows or slider to inspect each stroke.</p>}
  </div>;
}
