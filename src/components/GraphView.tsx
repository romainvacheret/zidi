import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, {
  type ForceGraphMethods,
  type GraphData,
  type NodeObject,
} from 'react-force-graph-2d';
import type { Graph, GraphNode } from '../types';
import { useElementSize } from '../hooks/useElementSize';
import GraphNodePreview from './GraphNodePreview';

interface GraphViewProps {
  graph: Graph;
  selection: { id: string } | null;
  onSelect(id: string): void;
  active?: boolean;
}

type LayoutNode = NodeObject<GraphNode>;

function labelBounds(node: LayoutNode, context: CanvasRenderingContext2D) {
  context.font = '12px sans-serif';
  return { width: context.measureText(node.id).width + 8, height: 20 };
}

export default function GraphView({ graph, selection, onSelect, active = true }: GraphViewProps) {
  const [containerRef, size] = useElementSize();
  const rendererRef = useRef<ForceGraphMethods<LayoutNode> | undefined>(undefined);
  const pendingFocus = useRef(false);
  const previewRef = useRef<HTMLElement>(null);
  const [dismissedSelection, setDismissedSelection] = useState<typeof selection>(null);

  // d3 adds coordinates and replaces link IDs with node references. Give it
  // private copies so those mutations cannot leak into vocabulary data or UI.
  const layout = useMemo<GraphData<GraphNode>>(() => ({
    nodes: graph.nodes.map(node => ({ ...node })),
    links: graph.links.map(link => ({ ...link })),
  }), [graph]);
  const nodesById = useMemo(() => new Map(layout.nodes.map(node => [node.id, node])), [layout]);

  const focusSelection = useCallback(() => {
    if (!pendingFocus.current || !selection || !rendererRef.current || !active || size.width <= 0 || size.height <= 0) return;
    const node = nodesById.get(selection.id);
    if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    rendererRef.current.centerAt(node.x, node.y, 300);
    pendingFocus.current = false;
  }, [nodesById, selection, active, size.width, size.height]);

  useEffect(() => {
    pendingFocus.current = selection !== null;
    focusSelection();
  }, [selection, focusSelection]);

  const selectedNode = selection ? nodesById.get(selection.id) : undefined;
  const showPreview = active && selectedNode && dismissedSelection !== selection;
  const positionPreview = useCallback(() => {
    const element = previewRef.current;
    if (!element || !selectedNode || !rendererRef.current || !Number.isFinite(selectedNode.x) || !Number.isFinite(selectedNode.y)) return;
    const point = rendererRef.current.graph2ScreenCoords(selectedNode.x!, selectedNode.y!);
    const visible = point.x >= 0 && point.x <= size.width && point.y >= 0 && point.y <= size.height;
    element.style.visibility = visible ? 'visible' : 'hidden';
    const left = Math.max(8, Math.min(point.x - element.offsetWidth / 2, size.width - element.offsetWidth - 8));
    const top = Math.max(8, Math.min(point.y + 22, size.height - element.offsetHeight - 8));
    element.style.transform = `translate(${left}px, ${top}px)`;
  }, [selectedNode, size.width, size.height]);

  useEffect(() => {
    if (!showPreview || !previewRef.current) return;
    positionPreview();
    const observer = new ResizeObserver(positionPreview);
    observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, [positionPreview, showPreview]);
  useEffect(() => {
    if (!showPreview) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissedSelection(selection);
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [showPreview, selection]);

  const drawNode = useCallback((node: LayoutNode, context: CanvasRenderingContext2D) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    const { width, height } = labelBounds(node, context);
    const selected = node.id === selection?.id;
    context.fillStyle = selected ? '#dbeafe' : 'rgba(255, 255, 255, 0.85)';
    context.fillRect(node.x! - width / 2, node.y! - height / 2, width, height);
    context.fillStyle = selected ? '#1d4ed8' : '#172b4d';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(node.id, node.x!, node.y!);
  }, [selection?.id]);

  const paintPointerArea = useCallback((
    node: LayoutNode,
    color: string,
    context: CanvasRenderingContext2D,
  ) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    const { width, height } = labelBounds(node, context);
    context.fillStyle = color;
    context.fillRect(node.x! - width / 2, node.y! - height / 2, width, height);
  }, []);

  return (
    <div className="graph-viewport" ref={containerRef}>
      <div className="graph-controls">
        <button type="button" onClick={() => rendererRef.current?.zoomToFit(300, 40)}>
          Fit graph
        </button>
      </div>
      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D<GraphNode>
          graphData={layout}
          ref={rendererRef}
          width={size.width}
          height={size.height}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={paintPointerArea}
          nodeLabel={() => ''}
          onNodeClick={node => onSelect(node.id)}
          onBackgroundClick={() => setDismissedSelection(selection)}
          onEngineTick={focusSelection}
          onRenderFramePost={positionPreview}
        />
      )}
      {showPreview && <aside ref={previewRef} className="graph-node-preview" aria-label="Selected graph entry">
        <button type="button" className="graph-preview-close" aria-label="Close graph tooltip"
          onClick={() => setDismissedSelection(selection)}>×</button>
        <GraphNodePreview key={selectedNode.id} node={selectedNode} />
        {!selectedNode.entries.length && <p className="graph-preview-note">{Array.from(selectedNode.id).length > 1 ? 'linked to its constituent characters' : 'shown as a standalone character'}</p>}
      </aside>}
    </div>
  );
}
