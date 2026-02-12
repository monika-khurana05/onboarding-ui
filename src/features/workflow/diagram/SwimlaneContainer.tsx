import { memo } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { NodeProps } from 'reactflow';
import type { SwimlaneData } from './layoutGraph';

export const SwimlaneContainer = memo(({ data }: NodeProps<SwimlaneData>) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.text.secondary, 0.2)}`,
        bgcolor: alpha(theme.palette.background.paper, 0.4),
        position: 'relative',
        pointerEvents: 'none'
      }}
    >
      <Typography
        variant="overline"
        sx={{
          position: 'absolute',
          top: 8,
          left: 12,
          color: alpha(theme.palette.text.secondary, 0.7),
          fontWeight: 600,
          letterSpacing: '0.08em'
        }}
      >
        {data.label}
      </Typography>
    </Box>
  );
});

SwimlaneContainer.displayName = 'SwimlaneContainer';
