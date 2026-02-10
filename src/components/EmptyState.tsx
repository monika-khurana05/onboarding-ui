import InboxIcon from '@mui/icons-material/Inbox';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { enterpriseDesign, spacingScale } from '../theme/designSystem';
import { InlineHelpText } from './InlineHelpText';

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
        p: `${enterpriseDesign.cardPadding.mobile}px`,
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: 'divider',
        borderRadius: `${enterpriseDesign.borderRadius}px`
      }}
    >
      <Stack spacing={spacingScale.s12} alignItems="center" textAlign="center">
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
        <Typography variant="h5">{title}</Typography>
        <InlineHelpText>{description}</InlineHelpText>
        {actionLabel && onAction ? (
          <Button variant="outlined" onClick={onAction} aria-label={actionLabel}>
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}
