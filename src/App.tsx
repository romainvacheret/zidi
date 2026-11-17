import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { getGraphNeighborhood, getGraphVocabulary, mergeGraph, filterGraphCharacters, vocabularyNodes, MAX_GRAPH_NODES } from './vocabulary';
import { graphTargetFromHash } from './navigation';
import type { Graph } from './types';
import CustomSideBar from './components/sidebar';
import GraphView from './components/GraphView';
import DictionaryView from './components/DictionaryView';

function App() {
  const [tab, setTab] = useState<'dictionary' | 'graph'>(() =>
    window.location.hash.startsWith('#/dictionary') ? 'dictionary' : 'graph');
  const [selection, setSelection] = useState<{ id: string } | null>(() => {
    const id = graphTargetFromHash();
    return id ? { id } : null;
  });
  const [neighborhood, setNeighborhood] = useState<{ id: string } | null>(() => {
    const id = graphTargetFromHash();
    return id ? { id } : null;
  });
  const [levels, setLevels] = useState<number[]>([1]);
  const [wordLimit, setWordLimit] = useState(() => graphTargetFromHash() ? 50 : 200);
  const [attempt, setAttempt] = useState(0);
  const [graph, setGraph] = useState<Graph>({ nodes: [], links: [] });
  const currentGraph = useRef(graph);
  currentGraph.current = graph;
  const [loading, setLoading] = useState(true);
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const loadedScope = useRef<{ target: string | null; limit: number } | null>(null);
  const expansion = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    expansion.current?.abort();
    setExpanding(false);
    setLoading(true);
    setError('');
    setNotice('');
    const target = neighborhood?.id || null;
    const preserve = loadedScope.current?.target === target && loadedScope.current?.limit === wordLimit
      ? currentGraph.current.nodes.filter(node => node.entries.length).map(node => node.id) : [];
    const request = levels.length === 0
      ? Promise.resolve({ entries: [], has_more: false, allowed_characters: [] })
      : neighborhood
      ? getGraphNeighborhood(neighborhood.id, wordLimit, controller.signal, levels, preserve)
      : preserve.length
        ? getGraphVocabulary(levels, wordLimit, controller.signal, undefined, [], preserve)
        : getGraphVocabulary(levels, wordLimit, controller.signal);
    request.then(result => {
      if (controller.signal.aborted) return;
      const id = neighborhood?.id;
      // Make room for a bookmarked selection even when the base graph is full.
      const showFocus = id && (result.allowed_characters == null || result.allowed_characters.includes(id)
        || result.entries.some(entry => entry.text === id));
      const selected = showFocus ? mergeGraph({ nodes: [], links: [] }, [], [id]) : { nodes: [], links: [] };
      const next = filterGraphCharacters(mergeGraph(selected, result.entries), result.allowed_characters);
      setGraph(next);
      loadedScope.current = { target, limit: wordLimit };
      vocabularyNodes.clear();
      for (const node of next.nodes) if (node.entries.length) vocabularyNodes.set(node.id, node);
      setNotice(levels.length === 0 ? 'Select at least one HSK level.' : neighborhood
        ? `Words connected to ${neighborhood.id} through shared characters.${!next.nodes.some(node => node.id === neighborhood.id) ? ' Focus is outside the selected levels.' : ''}${result.has_more ? ' Showing a subset within the per-level word limit and node ceiling.' : ''}`
        : result.has_more ? 'Showing a subset within the per-level word limit and node ceiling.' : 'All matching words loaded.');
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load graph.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); expansion.current?.abort(); };
  }, [levels, wordLimit, attempt, neighborhood]);

  const selectNode = useCallback((id: string) => {
    const previous = currentGraph.current;
    if (!previous.nodes.some(node => node.id === id)) {
      const next = mergeGraph(previous, [], [id]);
      if (!next.nodes.some(node => node.id === id)) {
        setNotice('The graph has reached its 500-node limit. Choose a smaller word limit to add entries.');
        return;
      }
      currentGraph.current = next;
      setGraph(next);
    }
    setSelection({ id });
  }, []);

  async function expandCharacter() {
    if (!selection || !levels.length || loading || expanding) return;
    const controller = new AbortController();
    expansion.current = controller;
    setExpanding(true);
    setError('');
    try {
      const result = await getGraphVocabulary(levels, 20, controller.signal, selection.id,
        graph.nodes.map(node => node.id));
      if (controller.signal.aborted) return;
      const previous = currentGraph.current;
      const next = filterGraphCharacters(mergeGraph(previous, result.entries), result.allowed_characters == null
        ? null : [...previous.nodes.filter(node => Array.from(node.id).length === 1).map(node => node.id), ...result.allowed_characters]);
      const added = result.entries.filter(entry => !previous.nodes.some(node => node.id === entry.text)
        && next.nodes.some(node => node.id === entry.text));
      currentGraph.current = next;
      setGraph(next);
      added.forEach(entry => vocabularyNodes.set(entry.text, { id: entry.text, entries: [entry] }));
      setNotice(added.length ? `Added ${added.length} related words.${result.has_more ? ' More are available.' : ''}`
        : 'No more related words fit this level and the 500-node limit.');
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not expand character.');
    } finally { if (!controller.signal.aborted) setExpanding(false); }
  }
  const focusNeighborhood = useCallback((id: string) => {
    setSelection({ id });
    setNeighborhood({ id });
    setWordLimit(50);
    window.history.replaceState(null, '', `#/graph/${encodeURIComponent(id)}`);
  }, []);

  function openTab(name: 'dictionary' | 'graph') {
    setTab(name);
    if (name === 'graph') {
      setNeighborhood(null);
      setLevels([1]);
      setWordLimit(200);
      setSelection(null);
      setAttempt(value => value + 1);
      window.history.replaceState(null, '', '#/graph');
    }
  }
  useEffect(() => {
    const navigate = () => {
      if (window.location.hash.startsWith('#/dictionary')) setTab('dictionary');
      else if (window.location.hash.startsWith('#/graph')) {
        setTab('graph');
        const id = graphTargetFromHash();
        if (id) focusNeighborhood(id);
        else {
          setNeighborhood(null);
          setLevels([1]);
          setWordLimit(200);
          setSelection(null);
        }
      }
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [focusNeighborhood]);

  return (
    <div className="app-shell">
      <nav className="app-tabs" aria-label="Features">
        <span className="app-brand">Zìdì <span lang="zh">字缔</span></span>
        <div role="tablist" aria-label="Features">
          {(['dictionary', 'graph'] as const).map(name => (
            <button key={name} id={`${name}-tab`} role="tab"
              aria-selected={tab === name} aria-controls={`${name}-panel`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => openTab(name)}
              onKeyDown={event => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault();
                  const next = event.key === 'Home' ? 'dictionary' : event.key === 'End' ? 'graph'
                    : name === 'graph' ? 'dictionary' : 'graph';
                  openTab(next);
                  document.getElementById(`${next}-tab`)?.focus();
                }
              }}>
              {name === 'dictionary' ? 'Dictionary' : 'Graph'}
            </button>
          ))}
        </div>
      </nav>
      <section id="dictionary-panel" className="feature-panel" role="tabpanel"
        aria-labelledby="dictionary-tab" tabIndex={0} hidden={tab !== 'dictionary'}>
        <DictionaryView active={tab === 'dictionary'} />
      </section>
      <section id="graph-panel" className="feature-panel" role="tabpanel"
        aria-labelledby="graph-tab" tabIndex={0} hidden={tab !== 'graph'}>
        <div className="App">
          <CustomSideBar
            key={neighborhood?.id || 'hsk'}
            nodes={graph.nodes}
            selectedId={selection?.id}
            onSelect={selectNode}
            neighborhood={neighborhood?.id} levels={levels} wordLimit={wordLimit} loading={loading}
            onLevelsChange={setLevels} onWordLimitChange={setWordLimit}
          />
          <main className="graph-main" aria-label="Word and character graph">
            <div className="graph-status" aria-live="polite">
              {loading ? <p role="status">Loading graph…</p> : <p>{notice} {graph.nodes.length}/{MAX_GRAPH_NODES} nodes.</p>}
              {error && <p role="alert">{error} <button onClick={() => setAttempt(value => value + 1)}>Try again</button></p>}
              {selection && <button type="button" disabled={loading}
                onClick={() => focusNeighborhood(selection.id)}>Focus on {selection.id}</button>}
              {neighborhood && <button type="button" onClick={() => openTab('graph')}>Back to HSK 1</button>}
              {!neighborhood && selection && /^\p{Script=Han}$/u.test(selection.id) && <button type="button"
                disabled={!levels.length || loading || expanding || graph.nodes.length >= MAX_GRAPH_NODES}
                onClick={expandCharacter}>{expanding ? 'Loading related words…' : `Expand ${selection.id} (+20 per level)`}</button>}
            </div>
            <GraphView graph={graph} selection={selection} onSelect={selectNode} active={tab === 'graph'} />
          </main>
        </div>
      </section>
    </div>
  );
}

export default App;
