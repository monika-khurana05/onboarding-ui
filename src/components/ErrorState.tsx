import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Alert, AlertTitle, Stack, Typography } from '@mui/material';
import { enterpriseDesign, spacingScale } from '../theme/designSystem';

import { Button } from '@ui/Button';
type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = 'Unable to load data',
  message = 'The request failed. You can retry without losing your progress.',
  onRetry
}: ErrorStateProps) {
  return (
    <Alert
      severity="error"
      icon={<ErrorOutlineIcon fontSize="inherit" />}
      sx={{ borderRadius: `${enterpriseDesign.borderRadius}px` }}
      action={
        onRetry ? (
          <Button
            variant="outlined"
            size="small"
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={onRetry}
            aria-label="Retry request"
          >
            Retry
          </Button>
        ) : null
      }
    >
      <AlertTitle>{title}</AlertTitle>
      <Stack spacing={spacingScale.s4}>
        <Typography variant="body2">{message}</Typography>
      </Stack>
    </Alert>
  );
}


