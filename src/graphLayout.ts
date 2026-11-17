import type { GraphData, NodeObject } from 'react-force-graph-2d';
import type { Graph, GraphNode } from './types';

export type LayoutNode = NodeObject<GraphNode>;

function hasPosition(node: LayoutNode): boolean {
  return Number.isFinite(node.x) && Number.isFinite(node.y);
}

export function pinNode(node: LayoutNode) {
  if (!hasPosition(node)) return;
  node.fx = node.x;
  node.fy = node.y;
  node.vx = 0;
  node.vy = 0;
}

// Each renderer owns its mutable simulation objects. Hidden nodes retain their
// positions in a bounded cache, so toggling levels doesn't scramble the layout.
export function createGraphLayout() {
  const cache = new Map<string, LayoutNode>();
  let layout: GraphData<GraphNode> = { nodes: [], links: [] };
  let linksById = new Map<string, GraphData<GraphNode>['links'][number]>();

  return {
    update(graph: Graph): GraphData<GraphNode> {
      const nodes = graph.nodes.map(source => {
        const node = cache.get(source.id) || { ...source };
        pinNode(node);
        Object.assign(node, { entries: source.entries });
        // Refresh insertion order for least recently displayed eviction.
        cache.delete(node.id);
        cache.set(node.id, node);
        return node;
      });
      const nodesById = new Map(nodes.map(node => [node.id, node]));
      const neighbors = new Map(nodes.map(node => [node.id, new Set<string>()]));
      for (const link of graph.links) {
        neighbors.get(link.source)?.add(link.target);
        neighbors.get(link.target)?.add(link.source);
      }

      // Spread additions around their already positioned neighbors. Traverse
      // outward so whole new branches start near the existing component.
      const queue = nodes.filter(hasPosition);
      const positioned = new Set(queue.map(node => node.id));
      for (let index = 0; index < queue.length; index++) {
        const parent = queue[index];
        for (const id of neighbors.get(parent.id) || []) {
          if (positioned.has(id)) continue;
          const node = nodesById.get(id)!;
          const anchors = [...neighbors.get(id)!].map(key => nodesById.get(key)!).filter(hasPosition);
          const x = anchors.reduce((sum, anchor) => sum + anchor.x!, 0) / anchors.length;
          const y = anchors.reduce((sum, anchor) => sum + anchor.y!, 0) / anchors.length;
          const hash = Array.from(id).reduce((value, char) => (value * 31 + char.codePointAt(0)!) >>> 0, 0);
          const angle = (hash % 360) * Math.PI / 180;
          const radius = 35 + hash % 35;
          node.x = x + Math.cos(angle) * radius;
          node.y = y + Math.sin(angle) * radius;
          node.vx = 0;
          node.vy = 0;
          positioned.add(id);
          queue.push(node);
        }
      }

      const nextLinks = new Map<string, GraphData<GraphNode>['links'][number]>();
      for (const source of graph.links) {
        const key = JSON.stringify([source.source, source.target]);
        nextLinks.set(key, linksById.get(key) || { ...source });
      }
      linksById = nextLinks;
      layout = { nodes, links: [...nextLinks.values()] };
      const visible = new Set(nodesById.keys());
      for (const id of cache.keys()) {
        if (cache.size <= 1500) break;
        if (!visible.has(id)) cache.delete(id);
      }
      return layout;
    },
    settle() {
      layout.nodes.forEach(pinNode);
    },
  };
}
