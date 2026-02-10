import { Box, CircularProgress, Typography } from '@mui/material';
import { spacingScale } from '../theme/designSystem';

type LoadingStateProps = {
  message?: string;
  minHeight?: number;
};

export function LoadingState({ message = 'Loading...', minHeight = 180 }: LoadingStateProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: spacingScale.s12
      }}
    >
      <CircularProgress size={28} aria-label="Loading indicator" />
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}


