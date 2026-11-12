import { useCallback, useEffect, useState } from 'react';
import './App.css';
import hsk1 from './hsk1.json';
import hsk2 from './hsk2.json';
import hsk3 from './hsk3.json';
import { toGraph } from './graph';
import CustomSideBar from './components/sidebar';
import GraphView from './components/GraphView';
import DictionaryView from './components/DictionaryView';

const graph = toGraph([...hsk1, ...hsk2, ...hsk3]);

function App() {
  const [tab, setTab] = useState<'dictionary' | 'graph'>(() =>
    window.location.hash.startsWith('#/dictionary') ? 'dictionary' : 'graph');
  useEffect(() => {
    const navigate = () => {
      if (window.location.hash.startsWith('#/dictionary')) setTab('dictionary');
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  const [selection, setSelection] = useState<{ id: string } | null>(null);
  // A new request also recenters a node that was selected before panning away.
  const selectNode = useCallback((id: string) => setSelection({ id }), []);

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
          />
          <main className="graph-main" aria-label="Word and character graph">
            <GraphView graph={graph} selection={selection} onSelect={selectNode} />
          </main>
        </div>
      </section>
    </div>
  );
}

export default App;
