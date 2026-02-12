import * as dagre from 'dagre';
import type { GraphEdge, GraphNode } from './toGraph';

export type LayoutDirection = 'LR' | 'TB';

export const DEFAULT_NODE_SIZE = {
  width: 180,
  height: 44
};

export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], direction: LayoutDirection = 'LR'): GraphNode[] {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: DEFAULT_NODE_SIZE.width,
      height: DEFAULT_NODE_SIZE.height
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const layout = dagreGraph.node(node.id) as { x: number; y: number } | undefined;
    if (!layout) {
      return node;
    }
    return {
      ...node,
      position: {
        x: layout.x - DEFAULT_NODE_SIZE.width / 2,
        y: layout.y - DEFAULT_NODE_SIZE.height / 2
      }
    };
  });
}
