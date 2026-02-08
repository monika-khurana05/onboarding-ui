import { Paper, Stack, Typography } from '@mui/material';
import type { PropsWithChildren, ReactNode } from 'react';

type SectionCardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}>;

export function SectionCard({ title, subtitle, actions, children }: SectionCardProps) {
  return (
    <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          gap={1}
        >
          <Stack spacing={0.5}>
            <Typography variant="h6">{title}</Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Stack>
          {actions}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}
