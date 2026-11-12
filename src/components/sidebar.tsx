import { Sidebar, Menu, MenuItem } from 'react-pro-sidebar';
import { useMemo, useRef, useState } from 'react';
import type { GraphNode } from '../types';
import { filterGraphNodes } from '../graphSearch';

interface SidebarProps {
  nodes: readonly GraphNode[];
  selectedId?: string;
  onSelect(id: string): void;
  supplementalCount?: number;
}

function CustomSideBar({ nodes, selectedId, onSelect, supplementalCount = 0 }: SidebarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const filteredNodes = useMemo(() => filterGraphNodes(nodes, query), [nodes, query]);
  function updateQuery(value: string) {
    setQuery(value);
    if (listRef.current) listRef.current.scrollTop = 0;
  }
  return (
    <Sidebar className="vocabulary-sidebar" width="clamp(180px, 25vw, 280px)" aria-label="Vocabulary">
      <header className="sidebar-header">
        <h1>Zìdì <span lang="zh">字缔</span></h1>
        <h2>Words and characters</h2>
        <p>{nodes.length} nodes · HSK 1–3{supplementalCount > 0 && ` + ${supplementalCount} dictionary selections`}</p>
        <label className="graph-sidebar-search" htmlFor="graph-sidebar-query">Search graph</label>
        <div className="graph-sidebar-search-row">
          <input id="graph-sidebar-query" ref={inputRef} type="search" value={query}
            placeholder="Chinese, pinyin or English" aria-controls="graph-sidebar-results"
            onChange={event => updateQuery(event.target.value)} />
          {query && <button type="button" className="graph-sidebar-clear" aria-label="Clear graph search"
            onClick={() => { updateQuery(''); inputRef.current?.focus(); }}>×</button>}
        </div>
        <p className="graph-sidebar-count" role="status" aria-live="polite">
          {query.trim() ? `${filteredNodes.length} of ${nodes.length} entries` : 'All entries'}
        </p>
      </header>
      <nav ref={listRef} id="graph-sidebar-results" className="vocabulary-list" aria-label="Words and characters">
        {filteredNodes.length === 0 && <p className="graph-sidebar-empty">No matching entries. Try another search.</p>}
        <Menu menuItemStyles={{
          button: { '&.ps-active': { backgroundColor: '#dbeafe', color: '#1d4ed8' } },
        }}>
          {filteredNodes.map(node => (
            <MenuItem
              key={node.id}
              component={<button type="button" aria-pressed={node.id === selectedId} />}
              active={node.id === selectedId}
              onClick={() => onSelect(node.id)}
            >
              <span lang="zh">{node.id}</span>
            </MenuItem>
          ))}
        </Menu>
      </nav>
    </Sidebar>
  );
}

export default CustomSideBar;
