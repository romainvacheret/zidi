import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { getGraphVocabulary, mergeGraph, vocabularyNodes, MAX_GRAPH_NODES } from './vocabulary';
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
  const [level, setLevel] = useState(1);
  const [wordLimit, setWordLimit] = useState(200);
  const [attempt, setAttempt] = useState(0);
  const [graph, setGraph] = useState<Graph>({ nodes: [], links: [] });
  const currentGraph = useRef(graph);
  currentGraph.current = graph;
  const [loading, setLoading] = useState(true);
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const expansion = useRef<AbortController | null>(null);
  const currentSelection = useRef(selection);
  currentSelection.current = selection;

  useEffect(() => {
    const controller = new AbortController();
    expansion.current?.abort();
    setExpanding(false);
    setLoading(true);
    setError('');
    setNotice('');
    getGraphVocabulary(level, wordLimit, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const id = currentSelection.current?.id;
      // Make room for a bookmarked selection even when the base graph is full.
      const selected = id ? mergeGraph({ nodes: [], links: [] }, [], [id]) : { nodes: [], links: [] };
      const next = mergeGraph(selected, result.entries);
      setGraph(next);
      vocabularyNodes.clear();
      for (const node of next.nodes) if (node.entries.length) vocabularyNodes.set(node.id, node);
      setNotice(result.has_more ? 'Showing a subset, ordered by usage frequency.' : 'All matching words loaded.');
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load graph.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); expansion.current?.abort(); };
  }, [level, wordLimit, attempt]);

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
    if (!selection || loading || expanding) return;
    const controller = new AbortController();
    expansion.current = controller;
    setExpanding(true);
    setError('');
    try {
      const result = await getGraphVocabulary(level, 20, controller.signal, selection.id,
        graph.nodes.map(node => node.id));
      if (controller.signal.aborted) return;
      const previous = currentGraph.current;
      const next = mergeGraph(previous, result.entries);
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
  useEffect(() => {
    const navigate = () => {
      if (window.location.hash.startsWith('#/dictionary')) setTab('dictionary');
      else if (window.location.hash.startsWith('#/graph')) {
        setTab('graph');
        const id = graphTargetFromHash();
        if (id) selectNode(id);
      }
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [selectNode]);

  return (
    <div className="app-shell">
      <nav className="app-tabs" aria-label="Features">
        <span className="app-brand">Zìdì <span lang="zh">字缔</span></span>
        <div role="tablist" aria-label="Features">
          {(['dictionary', 'graph'] as const).map(name => (
            <button key={name} id={`${name}-tab`} role="tab"
              aria-selected={tab === name} aria-controls={`${name}-panel`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
              onKeyDown={event => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault();
                  const next = event.key === 'Home' ? 'dictionary' : event.key === 'End' ? 'graph'
                    : name === 'graph' ? 'dictionary' : 'graph';
                  setTab(next);
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
            nodes={graph.nodes}
            selectedId={selection?.id}
            onSelect={selectNode}
            level={level} wordLimit={wordLimit} loading={loading}
            onLevelChange={setLevel} onWordLimitChange={setWordLimit}
          />
          <main className="graph-main" aria-label="Word and character graph">
            <div className="graph-status" aria-live="polite">
              {loading ? <p role="status">Loading graph…</p> : <p>{notice} {graph.nodes.length}/{MAX_GRAPH_NODES} nodes.</p>}
              {error && <p role="alert">{error} <button onClick={() => setAttempt(value => value + 1)}>Try again</button></p>}
              {selection && /^\p{Script=Han}$/u.test(selection.id) && <button type="button"
                disabled={loading || expanding || graph.nodes.length >= MAX_GRAPH_NODES}
                onClick={expandCharacter}>{expanding ? 'Loading related words…' : `Expand ${selection.id} (+20 words)`}</button>}
            </div>
            <GraphView graph={graph} selection={selection} onSelect={selectNode} active={tab === 'graph'} />
          </main>
        </div>
      </section>
    </div>
  );
}

export default App;
