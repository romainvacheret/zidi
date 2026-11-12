import { useCallback, useState } from 'react';
import './App.css';
import hsk1 from './hsk1.json';
import hsk2 from './hsk2.json';
import hsk3 from './hsk3.json';
import { toGraph } from './graph';
import CustomSideBar from './components/sidebar';
import GraphView from './components/GraphView';

const graph = toGraph([...hsk1, ...hsk2, ...hsk3]);

function App() {
  const [selection, setSelection] = useState<{ id: string } | null>(null);
  // A new request also recenters a node that was selected before panning away.
  const selectNode = useCallback((id: string) => setSelection({ id }), []);

  return (
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
  );
}

export default App;
