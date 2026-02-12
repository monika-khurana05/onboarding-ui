import { memo } from 'react';
import { Box, Divider, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { DiagramNodeData, StartNodeData } from './layoutGraph';

const stateColorMap = {
  processing: {
    bg: '#3B82F6',
    border: '#1D4ED8',
    text: '#F8FAFC'
  },
  external: {
    bg: '#8B5CF6',
    border: '#6D28D9',
    text: '#F8FAFC'
  },
  failure: {
    bg: '#FCA5A5',
    border: '#EF4444',
    text: '#0F172A'
  },
  success: {
    bg: '#14532D',
    border: '#166534',
    text: '#ECFDF5'
  }
};

export const CustomNode = memo(({ data }: NodeProps<DiagramNodeData>) => {
  const theme = useTheme();
  const colors = stateColorMap[data.stateType] ?? stateColorMap.processing;
  const highlightRing = data.isSelected
    ? `0 0 0 3px ${alpha(theme.palette.primary.light, 0.7)}`
    : data.highlighted
      ? `0 0 0 2px ${alpha(theme.palette.info.main, 0.5)}`
      : undefined;
  const borderRing = data.isTerminal ? `0 0 0 2px ${colors.border}` : undefined;
  const boxShadow = [borderRing, highlightRing].filter(Boolean).join(', ');

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        borderRadius: 2,
        bgcolor: colors.bg,
        border: `2px solid ${colors.border}`,
        color: colors.text,
        boxShadow,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        px: 1.5,
        py: 1.2,
        textAlign: 'center',
        overflow: 'hidden'
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
        {data.label}
      </Typography>
      {data.actionsSummary ? (
        <>
          <Divider sx={{ my: 0.8, borderColor: alpha(colors.text, 0.35) }} />
          <Typography variant="caption" sx={{ color: alpha(colors.text, 0.85), lineHeight: 1.3 }}>
            {data.actionsSummary}
          </Typography>
        </>
      ) : null}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </Box>
  );
});

export const StartNode = memo((_: NodeProps<StartNodeData>) => (
  <Box
    sx={{
      width: 18,
      height: 18,
      borderRadius: '50%',
      bgcolor: '#94A3B8',
      border: '2px solid #CBD5F1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 8,
      fontWeight: 700,
      color: '#0F172A'
    }}
  >
    <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
  </Box>
));

CustomNode.displayName = 'CustomNode';
StartNode.displayName = 'StartNode';
