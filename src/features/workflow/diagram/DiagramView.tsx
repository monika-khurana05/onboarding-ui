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
import { alpha, useTheme } from '@mui/material/styles';
import 'reactflow/dist/style.css';

type DiagramViewProps = {
  nodes: Node[];
  edges: Edge[];
};

function DiagramCanvas({ nodes, edges }: DiagramViewProps) {
  const { fitView } = useReactFlow();
  const theme = useTheme();
  const diagramColors = useMemo(() => {
    const isDark = theme.palette.mode === 'dark';
    return {
      nodeBg: isDark ? '#111827' : '#E2E8F0',
      nodeBorder: isDark ? '#334155' : '#94A3B8',
      nodeText: isDark ? '#F8FAFC' : '#0F172A',
      edge: isDark ? '#CBD5E1' : '#475569',
      labelBg: isDark ? '#F8FAFC' : '#0F172A',
      labelText: isDark ? '#0F172A' : '#F8FAFC',
      grid: alpha(theme.palette.text.secondary, 0.25),
      minimapMask: alpha(theme.palette.background.default, 0.85)
    };
  }, [theme]);

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        style: {
          background: diagramColors.nodeBg,
          border: `1px solid ${diagramColors.nodeBorder}`,
          color: diagramColors.nodeText,
          borderRadius: 10,
          padding: 8,
          minWidth: 140,
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: theme.typography.fontFamily,
          ...(node.style ?? {})
        }
      })),
    [nodes, diagramColors, theme]
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        style: {
          stroke: diagramColors.edge,
          strokeWidth: 1.6,
          ...(edge.style ?? {})
        },
        labelStyle: {
          fill: diagramColors.labelText,
          fontSize: 12,
          fontFamily: theme.typography.fontFamily,
          ...(edge.labelStyle ?? {})
        },
        labelBgStyle: {
          fill: diagramColors.labelBg,
          stroke: diagramColors.nodeBorder,
          strokeWidth: 0.8
        },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 6
      })),
    [edges, diagramColors, theme]
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
      style={{
        width: '100%',
        height: '100%',
        background: theme.palette.background.default
      }}
    >
      <MiniMap
        nodeStrokeColor={diagramColors.nodeBorder}
        nodeColor={diagramColors.nodeBg}
        maskColor={diagramColors.minimapMask}
      />
      <Controls showInteractive={false} />
      <Background gap={18} size={1} color={diagramColors.grid} />
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
