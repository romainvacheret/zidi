import { Sidebar, Menu, MenuItem } from 'react-pro-sidebar';
import type { GraphNode } from '../types';

interface SidebarProps {
  nodes: readonly GraphNode[];
  selectedId?: string;
  onSelect(id: string): void;
  supplementalCount?: number;
}

function CustomSideBar({ nodes, selectedId, onSelect, supplementalCount = 0 }: SidebarProps) {
  return (
    <Sidebar className="vocabulary-sidebar" width="clamp(180px, 25vw, 280px)" aria-label="Vocabulary">
      <header className="sidebar-header">
        <h1>Zìdì <span lang="zh">字缔</span></h1>
        <h2>Words and characters</h2>
        <p>{nodes.length} nodes · HSK 1–3{supplementalCount > 0 && ` + ${supplementalCount} dictionary selections`}</p>
      </header>
      <nav className="vocabulary-list" aria-label="Words and characters">
        <Menu menuItemStyles={{
          button: { '&.ps-active': { backgroundColor: '#dbeafe', color: '#1d4ed8' } },
        }}>
          {nodes.map(node => (
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
