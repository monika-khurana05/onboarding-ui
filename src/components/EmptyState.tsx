import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { enterpriseDesign, spacingScale } from '../theme/designSystem';
import { InlineHelpText } from './InlineHelpText';

import { Button } from '@ui/Button';
import { Card } from '@ui/Card';
type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = <Inventory2OutlinedIcon color="action" />,
  action
}: EmptyStateProps) {
  return (
    <Card
      role="status"
      variant="outlined"
      className="border-2 border-dashed border-border"
      sx={{
        p: `${enterpriseDesign.cardPadding.mobile}px`,
        borderRadius: `${enterpriseDesign.borderRadius}px`
      }}
    >
      <Stack spacing={spacingScale.s12} alignItems="center" textAlign="center">
        <Box className="flex h-11 w-11 items-center justify-center rounded-full bg-surface2">
          {icon}
        </Box>
        <Typography variant="h5">{title}</Typography>
        <InlineHelpText className="!text-muted">{description}</InlineHelpText>
        {action ?? null}
        {!action && actionLabel && onAction ? (
          <Button variant="primary" onClick={onAction} aria-label={actionLabel}>
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Card>
  );
}


