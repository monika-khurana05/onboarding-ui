import { useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  type Edge,
  type Node,
  useReactFlow
} from 'reactflow';
import { Button } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { CustomNode, StartNode } from './CustomNode';
import { CustomEdge } from './CustomEdge';
import { SwimlaneContainer } from './SwimlaneContainer';
import type { DiagramNodeData, DiagramEdgeData, SwimlaneData, StartNodeData } from './layoutGraph';
import 'reactflow/dist/style.css';

type DiagramViewProps = {
  nodes: Array<Node<DiagramNodeData | SwimlaneData | StartNodeData>>;
  edges: Array<Edge<DiagramEdgeData>>;
  onNodeSelect?: (node: Node<DiagramNodeData>) => void;
  selectedNodeId?: string | null;
};

function DiagramCanvas({ nodes, edges, onNodeSelect, selectedNodeId }: DiagramViewProps) {
  const { fitView } = useReactFlow();
  const theme = useTheme();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const highlightedEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    if (hoveredEdgeId) {
      ids.add(hoveredEdgeId);
    }
    if (hoveredNodeId) {
      edges.forEach((edge) => {
        if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) {
          ids.add(edge.id);
        }
      });
    }
    return ids;
  }, [edges, hoveredEdgeId, hoveredNodeId]);

  const decoratedEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          highlighted: highlightedEdgeIds.has(edge.id)
        }
      })),
    [edges, highlightedEdgeIds]
  );

  const decoratedNodes = useMemo(
    () =>
      nodes.map((node) => {
        if (node.type !== 'state') {
          return node;
        }
        return {
          ...node,
          data: {
            ...node.data,
            isSelected: node.id === selectedNodeId,
            highlighted: node.id === hoveredNodeId
          }
        };
      }),
    [nodes, hoveredNodeId, selectedNodeId]
  );

  const nodeTypes = useMemo(
    () => ({
      state: CustomNode,
      swimlane: SwimlaneContainer,
      start: StartNode
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      custom: CustomEdge
    }),
    []
  );

  return (
    <ReactFlow
      nodes={decoratedNodes}
      edges={decoratedEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      panOnScroll
      zoomOnScroll
      onlyRenderVisibleElements
      onNodeClick={(_, node) => {
        if (node.type === 'state' && onNodeSelect) {
          onNodeSelect(node as Node<DiagramNodeData>);
        }
      }}
      onNodeMouseEnter={(_, node) => {
        if (node.type === 'state') {
          setHoveredNodeId(node.id);
        }
      }}
      onNodeMouseLeave={() => setHoveredNodeId(null)}
      onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
      onEdgeMouseLeave={() => setHoveredEdgeId(null)}
      proOptions={{ hideAttribution: true }}
      style={{
        width: '100%',
        height: '100%',
        background: theme.palette.background.default
      }}
    >
      <MiniMap
        nodeStrokeColor={alpha(theme.palette.text.secondary, 0.5)}
        nodeColor={alpha(theme.palette.primary.main, 0.45)}
        maskColor={alpha(theme.palette.background.default, 0.85)}
      />
      <Controls showInteractive={false} />
      <Background gap={18} size={1} color={alpha(theme.palette.text.secondary, 0.2)} />
      <Panel position="top-right">
        <Button size="small" variant="outlined" onClick={() => fitView({ padding: 0.2 })}>
          Fit
        </Button>
      </Panel>
    </ReactFlow>
  );
}

export function DiagramView(props: DiagramViewProps) {
  return (
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  );
}
