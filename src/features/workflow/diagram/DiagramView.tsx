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
  actionLineText: string;
  canvasBg: string;
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

  const renderLabel = (labelTextValue: string) => {
    const lines = labelTextValue.split('\n');
    if (lines.length === 1) {
      return <span style={{ fontWeight: 700, fontSize: 12 }}>{lines[0]}</span>;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
        <span style={{ fontWeight: 700, fontSize: 12 }}>{lines[0]}</span>
        {lines.slice(1).map((line, index) => (
          <span key={`${lines[0]}-${index}`} style={{ fontWeight: 600, fontSize: 11, color: colors.actionLineText }}>
            {line}
          </span>
        ))}
      </div>
    );
  };

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
              padding: '6px 8px',
              fontSize: 12,
              fontFamily,
              fontWeight: 600,
              lineHeight: 1.35,
              textAlign: 'left',
              maxWidth: 260,
              pointerEvents: 'none',
              zIndex: 4,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)'
            }}
          >
            {renderLabel(label)}
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
    const canvasBg = isDark ? '#0B0F14' : '#F8FAFC';
    return {
      nodeBg: theme.palette.primary.main,
      nodeBorder: theme.palette.primary.light,
      nodeText: '#F8FAFC',
      edge: isDark ? '#CBD5E1' : '#475569',
      labelBg: isDark ? '#F8FAFC' : '#0F172A',
      labelText: isDark ? '#0F172A' : '#F8FAFC',
      actionLabelBg: isDark ? '#DBEAFE' : '#93C5FD',
      actionLabelText: '#0F172A',
      actionLineText: isDark ? '#1D4ED8' : '#1D4ED8',
      canvasBg,
      grid: alpha(theme.palette.text.secondary, 0.25),
      minimapMask: alpha(canvasBg, 0.85)
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
        background: diagramColors.canvasBg
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
