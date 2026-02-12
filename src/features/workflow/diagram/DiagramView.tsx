import { useMemo } from 'react';
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
import 'reactflow/dist/style.css';

type DiagramViewProps = {
  nodes: Node[];
  edges: Edge[];
};

function DiagramCanvas({ nodes, edges }: DiagramViewProps) {
  const { fitView } = useReactFlow();

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        style: {
          background: '#0f172a',
          border: '1px solid #1f2937',
          color: '#e2e8f0',
          borderRadius: 10,
          padding: 8,
          minWidth: 140,
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 600,
          ...(node.style ?? {})
        }
      })),
    [nodes]
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        style: {
          stroke: '#94a3b8',
          strokeWidth: 1.5,
          ...(edge.style ?? {})
        },
        labelStyle: {
          fill: '#e2e8f0',
          fontSize: 11,
          ...(edge.labelStyle ?? {})
        }
      })),
    [edges]
  );

  return (
    <ReactFlow
      nodes={styledNodes}
      edges={styledEdges}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <MiniMap
        nodeStrokeColor="#334155"
        nodeColor="#0f172a"
        maskColor="rgba(15, 23, 42, 0.85)"
      />
      <Controls showInteractive={false} />
      <Background gap={18} size={1} color="rgba(148, 163, 184, 0.2)" />
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
