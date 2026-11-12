import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { vocabularyGraph, vocabularyNodes } from './vocabulary';
import { graphTargetFromHash } from './navigation';
import type { GraphNode } from './types';
import { toGraph } from './graph';
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
  const [additionalNodes, setAdditionalNodes] = useState<GraphNode[]>(() =>
    selection && !vocabularyNodes.has(selection.id) ? [{ id: selection.id, entries: [] }] : []);
  const graph = useMemo(() => {
    if (!additionalNodes.length) return vocabularyGraph;
    const extra = toGraph(additionalNodes.map(node => ({ text: node.id, pronunciation: '', description: '' })));
    return {
      nodes: [...vocabularyGraph.nodes, ...extra.nodes.filter(node => !vocabularyNodes.has(node.id))
        .map(node => ({ id: node.id, entries: [] }))],
      links: [...vocabularyGraph.links, ...extra.links],
    };
  }, [additionalNodes]);
  // A new request also recenters a node that was selected before panning away.
  const selectNode = useCallback((id: string) => {
    if (!vocabularyNodes.has(id)) {
      setAdditionalNodes(nodes => nodes.some(node => node.id === id) ? nodes : [...nodes, { id, entries: [] }]);
    }
    setSelection({ id });
  }, []);
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
            supplementalCount={additionalNodes.length}
          />
          <main className="graph-main" aria-label="Word and character graph">
            <GraphView graph={graph} selection={selection} onSelect={selectNode} active={tab === 'graph'} />
          </main>
        </div>
      </section>
    </div>
  );
}

export default App;
