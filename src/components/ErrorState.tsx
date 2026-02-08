import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Alert, AlertTitle, Button, Stack, Typography } from '@mui/material';

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
      sx={{ borderRadius: 2 }}
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
      <Stack spacing={0.5}>
        <Typography variant="body2">{message}</Typography>
      </Stack>
    </Alert>
  );
}
