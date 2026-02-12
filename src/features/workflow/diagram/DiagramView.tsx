import { useMemo } from 'react';
import ReactFlow, {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MiniMap,
  Panel,
  ReactFlowProvider,
  type Edge,
  type EdgeProps,
  type Node,
  useReactFlow,
  getBezierPath
} from 'reactflow';
import { Button } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import 'reactflow/dist/style.css';

type DiagramViewProps = {
  nodes: Node[];
  edges: Edge[];
};

type DiagramColors = {
  nodeBg: string;
  nodeBorder: string;
  nodeText: string;
  edge: string;
  labelBg: string;
  labelText: string;
  actionLabelBg: string;
  actionLabelText: string;
  grid: string;
  minimapMask: string;
};

type LabelledEdgeData = {
  labelOffsetX?: number;
  labelOffsetY?: number;
  hasActions?: boolean;
};

function LabelledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  label,
  data,
  style,
  colors,
  fontFamily
}: EdgeProps & { colors: DiagramColors; fontFamily: string }) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition
  });
  const offsetX = (data as LabelledEdgeData | undefined)?.labelOffsetX ?? 0;
  const offsetY = (data as LabelledEdgeData | undefined)?.labelOffsetY ?? 0;
  const hasActions = (data as LabelledEdgeData | undefined)?.hasActions ?? false;
  const labelBg = hasActions ? colors.actionLabelBg : colors.labelBg;
  const labelText = hasActions ? colors.actionLabelText : colors.labelText;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + offsetX}px,${labelY + offsetY}px)`,
              background: labelBg,
              color: labelText,
              border: `1px solid ${colors.nodeBorder}`,
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: 12,
              fontFamily,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 4,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)'
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

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
      actionLabelBg: isDark ? '#BFDBFE' : '#93C5FD',
      actionLabelText: '#0F172A',
      grid: alpha(theme.palette.text.secondary, 0.25),
      minimapMask: alpha(theme.palette.background.default, 0.85)
    };
  }, [theme]);
  const edgeTypes = useMemo(
    () => ({
      labelled: (props: EdgeProps) => (
        <LabelledEdge {...props} colors={diagramColors} fontFamily={theme.typography.fontFamily} />
      )
    }),
    [diagramColors, theme.typography.fontFamily]
  );

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
        type: edge.type ?? 'labelled',
        style: {
          stroke: diagramColors.edge,
          strokeWidth: 1.6,
          ...(edge.style ?? {})
        }
      })),
    [edges, diagramColors, theme]
  );

  return (
    <ReactFlow
      nodes={styledNodes}
      edges={styledEdges}
      edgeTypes={edgeTypes}
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
