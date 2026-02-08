import InboxIcon from '@mui/icons-material/Inbox';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Paper
      role="status"
      variant="outlined"
      sx={{
        p: 3,
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: 'divider'
      }}
    >
      <Stack spacing={1.5} alignItems="center" textAlign="center">
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <InboxIcon color="action" />
        </Box>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        {actionLabel && onAction ? (
          <Button variant="outlined" onClick={onAction} aria-label={actionLabel}>
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}
