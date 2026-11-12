import { useCallback, useEffect, useMemo, useRef } from 'react';
import ForceGraph2D, {
  type ForceGraphMethods,
  type GraphData,
  type NodeObject,
} from 'react-force-graph-2d';
import type { Graph, GraphNode } from '../types';
import { useElementSize } from '../hooks/useElementSize';

interface GraphViewProps {
  graph: Graph;
  selection: { id: string } | null;
  onSelect(id: string): void;
}

type LayoutNode = NodeObject<GraphNode>;

function labelBounds(node: LayoutNode, context: CanvasRenderingContext2D) {
  context.font = '12px sans-serif';
  return { width: context.measureText(node.id).width + 8, height: 20 };
}

export default function GraphView({ graph, selection, onSelect }: GraphViewProps) {
  const [containerRef, size] = useElementSize();
  const rendererRef = useRef<ForceGraphMethods<LayoutNode> | undefined>(undefined);
  const pendingFocus = useRef(false);

  // d3 adds coordinates and replaces link IDs with node references. Give it
  // private copies so those mutations cannot leak into vocabulary data or UI.
  const layout = useMemo<GraphData<GraphNode>>(() => ({
    nodes: graph.nodes.map(node => ({ ...node })),
    links: graph.links.map(link => ({ ...link })),
  }), [graph]);
  const nodesById = useMemo(() => new Map(layout.nodes.map(node => [node.id, node])), [layout]);

  const focusSelection = useCallback(() => {
    if (!pendingFocus.current || !selection || !rendererRef.current) return;
    const node = nodesById.get(selection.id);
    if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    rendererRef.current.centerAt(node.x, node.y, 300);
    pendingFocus.current = false;
  }, [nodesById, selection]);

  useEffect(() => {
    pendingFocus.current = selection !== null;
    focusSelection();
  }, [selection, focusSelection]);

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
          onNodeClick={node => onSelect(node.id)}
          onEngineTick={focusSelection}
        />
      )}
    </div>
  );
}
