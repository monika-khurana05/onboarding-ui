import { memo } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow';
import type { DiagramEdgeData } from './layoutGraph';

const edgePalette = {
  success: '#94A3B8',
  failure: '#EF4444',
  retry: '#F59E0B',
  external: '#8B5CF6',
  start: '#60A5FA'
};

export const CustomEdge = memo((props: EdgeProps<DiagramEdgeData>) => {
  const theme = useTheme();
  const { data } = props;
  const kind = data?.kind ?? 'success';
  const baseStroke = edgePalette[kind] ?? edgePalette.success;
  const isHighlighted = data?.highlighted ?? false;
  const stroke = isHighlighted ? alpha(baseStroke, 0.95) : baseStroke;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition
  });

  const eventName = data?.eventName ?? props.label?.toString() ?? '';
  const actionsCount = data?.actionsCount ?? 0;
  const labelPadding = 8;

  const dx = props.targetX - props.sourceX;
  const dy = props.targetY - props.sourceY;
  const distance = Math.hypot(dx, dy) || 1;
  const normalX = distance === 0 ? 0 : -dy / distance;
  const normalY = distance === 0 ? -1 : dx / distance;
  const labelHeight = 22 + (actionsCount > 0 ? 10 : 0);
  const clearance = 120 + labelHeight / 2 + Math.max(0, 160 - distance) * 0.2;
  const adjustedLabelX = labelX + normalX * clearance;
  const adjustedLabelY = labelY + normalY * clearance;

  const strokeDasharray = kind === 'retry' ? '6 5' : undefined;
  const strokeWidth = isHighlighted ? 2.8 : 1.6;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={edgePath}
        markerEnd={props.markerEnd}
        style={{ stroke, strokeWidth, strokeDasharray }}
      />
      {eventName ? (
        <EdgeLabelRenderer>
          <Box
            sx={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${adjustedLabelX}px,${adjustedLabelY}px)`,
              bgcolor: alpha(theme.palette.background.paper, 0.95),
              border: `1px solid ${alpha(theme.palette.text.secondary, 0.3)}`,
              borderRadius: 1,
              px: labelPadding / 2,
              py: 0.4,
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              pointerEvents: 'none',
              zIndex: 2
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
              {eventName}
              {actionsCount > 0 ? ` (${actionsCount} action${actionsCount === 1 ? '' : 's'})` : ''}
            </Typography>
          </Box>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});

CustomEdge.displayName = 'CustomEdge';
